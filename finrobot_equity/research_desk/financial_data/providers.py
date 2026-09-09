"""Bulk report adapters. Field aliases are declared in the metric registry."""

import asyncio

from .normalize import metric, number, sec_reports
from .registry import DERIVED, METRICS


class SecReports:
    name = "SEC EDGAR"

    def __init__(self, sources):
        self.sources = sources

    async def load(self, symbol):
        cik, headers = await self.sources.sec_identity(symbol)
        if not cik:
            return []
        raw = await self.sources.http.json(
            "sec", f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json", headers=headers
        )
        return sec_reports(raw)


class FmpReports:
    name = "FMP"

    def __init__(self, client):
        self.client = client

    async def load(self, symbol):
        async def get(endpoint):
            try:
                return await self.client.get(
                    "FMP", endpoint, {"symbol": symbol, "period": "annual", "limit": 5}
                )
            except Exception:
                return []

        income, balance, cash = await asyncio.gather(
            *(
                get(x)
                for x in ("income-statement", "balance-sheet-statement", "cash-flow-statement")
            )
        )
        if not isinstance(income, list):
            return []
        result = []
        for anchor in income:
            if anchor.get("period") not in (None, "FY"):
                continue
            end = anchor.get("date")
            currency = anchor.get("reportedCurrency")
            if not end or not currency:
                continue
            tables = {"income": anchor}
            for kind, rows in [("balance", balance), ("cash", cash)]:
                tables[kind] = next(
                    (
                        r
                        for r in rows
                        if r.get("date") == end and r.get("reportedCurrency") == currency
                    ),
                    {},
                )
            fields = {}
            for key, spec in METRICS.items():
                if not spec.fmp:
                    continue
                table, column = spec.fmp
                row = tables[table]
                value = number(row.get(column))
                if value is None:
                    continue
                # FMP/Yahoo cash-flow working capital is a cash contribution; model uses investment.
                if key == "working_capital_change":
                    value = -value
                if key == "capex":
                    value = abs(value)
                fields[key] = metric(
                    value,
                    self.name,
                    column,
                    row.get("finalLink") or row.get("link"),
                    end,
                    currency,
                    spec.unit,
                    row.get("filingDate"),
                )
            result.append(
                {
                    "period": end,
                    "start": None,
                    "year": int(anchor.get("fiscalYear") or end[:4]),
                    "currency": currency,
                    "fields": fields,
                }
            )
        return result


class YahooReports:
    name = "Yahoo Finance"

    def __init__(self, loader):
        self.loader = loader

    async def load(self, symbol):
        raw = await self.loader(symbol)
        result = []
        for report in raw.get("reports", []):
            fields = {}
            end = report["period"]
            currency = raw["currency"]
            for key, spec in METRICS.items():
                if not spec.yahoo:
                    continue
                table, column = spec.yahoo
                value = number(report.get(table, {}).get(column))
                if value is None:
                    continue
                if key == "capex":
                    value = abs(value)
                if key == "working_capital_change":
                    value = -value
                fields[key] = metric(
                    value, self.name, column, raw["source_url"], end, currency, spec.unit
                )
            if fields:
                result.append(
                    {
                        "period": end,
                        "start": None,
                        "year": int(end[:4]),
                        "currency": currency,
                        "fields": fields,
                    }
                )
        return result


class ChinaReports:
    name = "China public statements"

    def __init__(self, sources):
        self.sources = sources

    async def load(self, symbol):
        raw = await self.sources.china(symbol, "financials")
        fields = {
            key: metric(
                value,
                self.name,
                key,
                raw.get("source_url"),
                raw["period"],
                raw["currency"],
                METRICS[key].unit,
                raw.get("filed"),
            )
            for key, value in raw["metrics"].items()
            if key in METRICS
            and key not in DERIVED
            and key != "revenue_growth"
            and value is not None
        }
        reports = [
            {
                "period": raw["period"],
                "start": raw["period"][:4] + "-01-01",
                "year": int(raw["period"][:4]),
                "currency": raw["currency"],
                "fields": fields,
            }
        ]

        if raw.get("prior_period") and raw.get("prior_revenue") is not None:
            prior = raw["prior_period"]
            reports.append(
                {
                    "period": prior,
                    "start": prior[:4] + "-01-01",
                    "year": int(prior[:4]),
                    "currency": raw["currency"],
                    "fields": {
                        "revenue": metric(
                            raw["prior_revenue"],
                            self.name,
                            "营业收入",
                            raw.get("source_url"),
                            prior,
                            raw["currency"],
                        )
                    },
                }
            )
        return reports


class FinnhubReports:
    name = "Finnhub reported financials"

    def __init__(self, client):
        self.client = client

    async def load(self, symbol):
        raw = await self.client.get(
            "Finnhub", "stock/financials-reported", {"symbol": symbol, "freq": "annual"}
        )
        facts = {"cik": raw.get("cik", 0), "facts": {}}
        for report in raw.get("data", []):
            facts["cik"] = report.get("cik", facts["cik"])
            for table, fields in report.get("report", {}).items():
                for field in fields:
                    concept = field.get("concept", "")
                    if "_" not in concept:
                        continue
                    namespace, tag = concept.split("_", 1)
                    unit = field.get("unit", "").upper()
                    unit = "shares" if unit == "SHARES" else unit
                    entry = {
                        "val": field.get("value"),
                        "fy": report.get("year"),
                        "end": report["endDate"][:10],
                        "filed": report["filedDate"][:10],
                        "form": report["form"],
                        "accn": report["accessNumber"],
                    }
                    if table != "bs":
                        entry["start"] = report["startDate"][:10]
                    facts["facts"].setdefault(namespace, {}).setdefault(tag, {"units": {}})[
                        "units"
                    ].setdefault(unit, []).append(entry)
        result = sec_reports(facts)
        for report in result:
            for field in report["fields"].values():
                field["provider"] = self.name
        return result
