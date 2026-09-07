import os
import requests
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from ..utils import decorate_all_methods, get_next_weekday

# from finrobot.utils import decorate_all_methods, get_next_weekday
from functools import wraps
from typing import Annotated, List


def init_fmp_api(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        global fmp_api_key
        if os.environ.get("FMP_API_KEY") is None:
            print("Please set the environment variable FMP_API_KEY to use the FMP API.")
            return None
        else:
            fmp_api_key = os.environ["FMP_API_KEY"]
            print("FMP api key found successfully.")
            return func(*args, **kwargs)

    return wrapper


FMP_STABLE_BASE_URL = "https://financialmodelingprep.com/stable"


@decorate_all_methods(init_fmp_api)
class FMPUtils:

    def get_target_price(
        ticker_symbol: Annotated[str, "ticker symbol"],
        date: Annotated[str, "date of the target price, should be 'yyyy-mm-dd'"],
    ) -> str:
        """Get the target price for a given stock on a given date"""
        # API URL (FMP stable; legacy v4/price-target was retired on 2025-08-31)
        url = f"{FMP_STABLE_BASE_URL}/price-target-consensus?symbol={ticker_symbol}&apikey={fmp_api_key}"

        # 发送GET请求
        price_target = "Not Given"
        response = requests.get(url)

        # 确保请求成功
        if response.status_code == 200:
            # 解析JSON数据
            data = response.json()
            if data:
                consensus = data[0]
                low = consensus.get("targetLow")
                high = consensus.get("targetHigh")
                median = consensus.get("targetMedian")
                if low is not None and high is not None:
                    price_target = f"{low} - {high} (md. {median})"
                else:
                    price_target = "N/A"
            else:
                price_target = "N/A"
        else:
            return f"Failed to retrieve data: {response.status_code}"

        return price_target

    def get_sec_report(
        ticker_symbol: Annotated[str, "ticker symbol"],
        fyear: Annotated[
            str,
            "year of the 10-K report, should be 'yyyy' or 'latest'. Default to 'latest'",
        ] = "latest",
    ) -> str:
        """Get the url and filing date of the 10-K report for a given stock and year.

        Uses the free SEC EDGAR API (FMP's sec_filings endpoint is premium-gated).
        """

        headers = {"User-Agent": "FinRobot admin@finrobot.com"}

        # 1. Resolve ticker -> CIK via SEC's official mapping
        mapping_resp = requests.get(
            "https://www.sec.gov/files/company_tickers.json", headers=headers
        )
        if mapping_resp.status_code != 200:
            return f"Failed to retrieve data: {mapping_resp.status_code}"
        cik = None
        for entry in mapping_resp.json().values():
            if entry["ticker"].upper() == ticker_symbol.upper():
                cik = entry["cik_str"]
                break
        if cik is None:
            return f"Failed to retrieve data: ticker {ticker_symbol} not found in SEC mapping"

        # 2. Fetch recent filings and find the 10-K
        sub_resp = requests.get(
            f"https://data.sec.gov/submissions/CIK{cik:010d}.json", headers=headers
        )
        if sub_resp.status_code != 200:
            return f"Failed to retrieve data: {sub_resp.status_code}"
        recent = sub_resp.json()["filings"]["recent"]

        filing_url = None
        filing_date = None
        for form, date_filed, accession, primary_doc in zip(
            recent["form"],
            recent["filingDate"],
            recent["accessionNumber"],
            recent["primaryDocument"],
        ):
            if form != "10-K":
                continue
            if fyear == "latest" or date_filed.split("-")[0] == fyear:
                accession_no_dash = accession.replace("-", "")
                filing_url = (
                    f"https://www.sec.gov/Archives/edgar/data/{cik}/"
                    f"{accession_no_dash}/{primary_doc}"
                )
                filing_date = date_filed
                break

        if filing_url is None:
            return f"Failed to retrieve data: no 10-K filing found for {ticker_symbol}"
        return f"Link: {filing_url}\nFiling Date: {filing_date}"

    def get_historical_market_cap(
        ticker_symbol: Annotated[str, "ticker symbol"],
        date: Annotated[str, "date of the market cap, should be 'yyyy-mm-dd'"],
    ) -> str:
        """Get the historical market capitalization for a given stock on a given date"""
        date = get_next_weekday(date).strftime("%Y-%m-%d")
        url = f"{FMP_STABLE_BASE_URL}/historical-market-capitalization?symbol={ticker_symbol}&limit=100&from={date}&to={date}&apikey={fmp_api_key}"

        # 发送GET请求
        mkt_cap = None
        response = requests.get(url)

        # 确保请求成功
        if response.status_code == 200:
            # 解析JSON数据
            data = response.json()
            mkt_cap = data[0]["marketCap"]
            return mkt_cap
        else:
            return f"Failed to retrieve data: {response.status_code}"

    def get_historical_bvps(
        ticker_symbol: Annotated[str, "ticker symbol"],
        target_date: Annotated[str, "date of the BVPS, should be 'yyyy-mm-dd'"],
    ) -> str:
        """Get the historical book value per share for a given stock on a given date.

        Computed as totalStockholdersEquity / weightedAverageShsOut because FMP's
        stable API no longer exposes bookValuePerShare directly.
        """
        # limit is capped at 5 on lower FMP subscription tiers
        balance_url = f"{FMP_STABLE_BASE_URL}/balance-sheet-statement?symbol={ticker_symbol}&limit=5&apikey={fmp_api_key}"
        income_url = f"{FMP_STABLE_BASE_URL}/income-statement?symbol={ticker_symbol}&limit=5&apikey={fmp_api_key}"
        balance_resp = requests.get(balance_url)
        income_resp = requests.get(income_url)
        if balance_resp.status_code != 200 or income_resp.status_code != 200:
            return f"Failed to retrieve data: {balance_resp.status_code}/{income_resp.status_code}"
        balance_data = balance_resp.json()
        income_data = income_resp.json()

        if not balance_data or not income_data:
            return "No data available"

        # shares outstanding per fiscal period, keyed by period end date
        shares_by_date = {
            entry["date"]: entry.get("weightedAverageShsOut")
            for entry in income_data
            if entry.get("weightedAverageShsOut")
        }

        # 找到最接近目标日期的数据
        closest_bvps = None
        min_date_diff = float("inf")
        target_date = datetime.strptime(target_date, "%Y-%m-%d")
        for entry in balance_data:
            equity = entry.get("totalStockholdersEquity")
            shares = shares_by_date.get(entry["date"])
            if equity is None or not shares:
                continue
            date_of_data = datetime.strptime(entry["date"], "%Y-%m-%d")
            date_diff = abs(target_date - date_of_data).days
            if date_diff < min_date_diff:
                min_date_diff = date_diff
                closest_bvps = equity / shares

        if closest_bvps is not None:
            return round(closest_bvps, 2)
        else:
            return "No close date data found"
        
    def get_financial_metrics(
        ticker_symbol: Annotated[str, "ticker symbol"],
        years: Annotated[int, "number of the years to search from, default to 4"] = 4
    ) -> pd.DataFrame:
        """Get the financial metrics for a given stock for the last 'years' years"""
        # Base URL setup for FMP API (stable; legacy /api/v3 was retired on 2025-08-31)
        base_url = FMP_STABLE_BASE_URL
        # Create DataFrame
        df = pd.DataFrame()

        # Iterate over the last 'years' years of data
        for year_offset in range(years):
            # Construct URL for income statement and ratios for each year
            income_statement_url = f"{base_url}/income-statement?symbol={ticker_symbol}&limit={years}&apikey={fmp_api_key}"
            ratios_url = (
                f"{base_url}/ratios?symbol={ticker_symbol}&limit={years}&apikey={fmp_api_key}"
            )
            key_metrics_url = f"{base_url}/key-metrics?symbol={ticker_symbol}&limit={years}&apikey={fmp_api_key}"

            # Requesting data from the API
            income_data = requests.get(income_statement_url).json()
            key_metrics_data = requests.get(key_metrics_url).json()
            ratios_data = requests.get(ratios_url).json()

            # Extracting needed metrics for each year
            if income_data and key_metrics_data and ratios_data:
                metrics = {
                    "Revenue": round(income_data[year_offset]["revenue"] / 1e6),
                    "Revenue Growth": "{}%".format(round(((income_data[year_offset]["revenue"] - income_data[year_offset - 1]["revenue"]) / income_data[year_offset - 1]["revenue"])*100,1)),
                    "Gross Revenue": round(income_data[year_offset]["grossProfit"] / 1e6),
                    "Gross Margin": round((income_data[year_offset]["grossProfit"] / income_data[year_offset]["revenue"]),2),
                    "EBITDA": round(income_data[year_offset]["ebitda"] / 1e6),
                    "EBITDA Margin": round((ratios_data[year_offset]["ebitdaMargin"]),2),
                    "FCF": round(key_metrics_data[year_offset]["enterpriseValue"] / key_metrics_data[year_offset]["evToOperatingCashFlow"] / 1e6),
                    "FCF Conversion": round(((key_metrics_data[year_offset]["enterpriseValue"] / key_metrics_data[year_offset]["evToOperatingCashFlow"]) / income_data[year_offset]["netIncome"]),2),
                    "ROIC":"{}%".format(round((key_metrics_data[year_offset]["returnOnInvestedCapital"])*100,1)),
                    "EV/EBITDA": round((key_metrics_data[year_offset][
                        "evToEBITDA"
                    ]),2),
                    "PE Ratio": round(ratios_data[year_offset]["priceToEarningsRatio"],2),
                    "PB Ratio": round(ratios_data[year_offset]["priceToBookRatio"],2),
                }
                # Append the year and metrics to the DataFrame
                # Extracting the year from the date
                year = income_data[year_offset]["date"][:4]
                df[year] = pd.Series(metrics)

        df = df.sort_index(axis=1)

        return df

    def get_competitor_financial_metrics(
        ticker_symbol: Annotated[str, "ticker symbol"], 
        competitors: Annotated[List[str], "list of competitor ticker symbols"],  
        years: Annotated[int, "number of the years to search from, default to 4"] = 4
    ) -> dict:
        """Get financial metrics for the company and its competitors."""
        base_url = FMP_STABLE_BASE_URL
        all_data = {}

        symbols = [ticker_symbol] + competitors  # Combine company and competitors into one list
    
        for symbol in symbols:
            income_statement_url = f"{base_url}/income-statement?symbol={symbol}&limit={years}&apikey={fmp_api_key}"
            ratios_url = f"{base_url}/ratios?symbol={symbol}&limit={years}&apikey={fmp_api_key}"
            key_metrics_url = f"{base_url}/key-metrics?symbol={symbol}&limit={years}&apikey={fmp_api_key}"

            income_data = requests.get(income_statement_url).json()
            ratios_data = requests.get(ratios_url).json()
            key_metrics_data = requests.get(key_metrics_url).json()

            metrics = {}

            if income_data and ratios_data and key_metrics_data:
                for year_offset in range(years):
                    metrics[year_offset] = {
                        "Revenue": round(income_data[year_offset]["revenue"] / 1e6),
                        "Revenue Growth": (
                            "{}%".format((round(income_data[year_offset]["revenue"] - income_data[year_offset - 1]["revenue"] / income_data[year_offset - 1]["revenue"])*100,1))
                            if year_offset > 0 else None
                        ),
                        "Gross Margin": round((income_data[year_offset]["grossProfit"] / income_data[year_offset]["revenue"]),2),
                        "EBITDA Margin": round((ratios_data[year_offset]["ebitdaMargin"]),2),
                        "FCF Conversion": round((
                            key_metrics_data[year_offset]["enterpriseValue"] 
                            / key_metrics_data[year_offset]["evToOperatingCashFlow"] 
                            / income_data[year_offset]["netIncome"]
                            if key_metrics_data[year_offset]["evToOperatingCashFlow"] != 0 else None
                        ),2),
                        "ROIC":"{}%".format(round((key_metrics_data[year_offset]["returnOnInvestedCapital"])*100,1)),
                        "EV/EBITDA": round((key_metrics_data[year_offset]["evToEBITDA"]),2),
                    }

            df = pd.DataFrame.from_dict(metrics, orient='index')
            df = df.sort_index(axis=1)
            all_data[symbol] = df

        return all_data



if __name__ == "__main__":
    from finrobot.utils import register_keys_from_json

    register_keys_from_json("config_api_keys")
    FMPUtils.get_sec_report("NEE", "2024")
