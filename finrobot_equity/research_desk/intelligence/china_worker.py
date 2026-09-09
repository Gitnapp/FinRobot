"""Public A-share statements and CNINFO announcements, isolated from request threads."""

import json
import math
import sys
from datetime import date, timedelta

import akshare as ak

symbol, kind = sys.argv[1:3]
code, exchange = symbol.split(".")


def number(row, key):
    try:
        value = float(row[key])
        return value if math.isfinite(value) else None
    except (KeyError, TypeError, ValueError):
        return None


def day(value):
    value = str(value)[:10].replace("-", "")
    return f"{value[:4]}-{value[4:6]}-{value[6:8]}"


if kind == "filings":
    end = date.today()
    start = end - timedelta(days=365)
    frame = ak.stock_zh_a_disclosure_report_cninfo(
        symbol=code,
        market="沪深京",
        start_date=start.strftime("%Y%m%d"),
        end_date=end.strftime("%Y%m%d"),
    )
    result = {
        "filings": [
            {"form": str(r["公告标题"]), "date": str(r["公告时间"])[:10], "url": str(r["公告链接"])}
            for _, r in frame.iterrows()
            if str(r["公告链接"]).startswith(("http://", "https://"))
        ],
        "source": "巨潮资讯",
        "complete": False,
        "from": start.isoformat(),
        "to": end.isoformat(),
    }
else:
    stock = exchange.lower() + code
    income = ak.stock_financial_report_sina(stock=stock, symbol="利润表")
    cash = ak.stock_financial_report_sina(stock=stock, symbol="现金流量表")
    annual = income[income["报告日"].astype(str).str.endswith("1231")].sort_values(
        "报告日", ascending=False
    )
    if annual.empty:
        raise ValueError("annual_statement_unavailable")
    row = annual.iloc[0]
    period = str(row["报告日"])
    cash_rows = cash[cash["报告日"].astype(str) == period]
    flow = cash_rows.iloc[0] if len(cash_rows) else {}
    currency = row.get("币种")
    if currency != "CNY":
        raise ValueError("currency_mismatch")
    revenue = number(row, "营业收入")
    cost = number(row, "营业成本")
    net = number(row, "净利润")
    operating = number(flow, "经营活动产生的现金流量净额")
    capex = number(flow, "购建固定资产、无形资产和其他长期资产所支付的现金")
    prior = annual[annual["报告日"].astype(str) == str(int(period[:4]) - 1) + "1231"]
    prior_revenue = number(prior.iloc[0], "营业收入") if len(prior) else None
    result = {
        "period": day(period),
        "filed": day(row.get("公告日期", period)),
        "currency": currency,
        "prior_period": day(prior.iloc[0]["报告日"]) if len(prior) else None,
        "prior_revenue": prior_revenue,
        "source": "公开定期报告 / 新浪财经",
        "source_url": f"https://vip.stock.finance.sina.com.cn/corp/go.php/vFD_FinanceSummary/stockid/{code}.phtml",
        "filings": [],
        "metrics": {
            "revenue": revenue,
            "cost_of_revenue": cost,
            "operating_income": number(row, "营业利润"),
            "pretax_income": number(row, "利润总额"),
            "income_tax": number(row, "所得税费用"),
            "interest_expense": number(row, "利息费用"),
            "research_development": number(row, "研发费用"),
            "revenue_growth": revenue / prior_revenue - 1
            if revenue is not None and prior_revenue
            else None,
            "gross_margin": (revenue - cost) / revenue if revenue and cost is not None else None,
            "net_income": net,
            "operating_cash_flow": operating,
            "free_cash_flow": operating - capex
            if operating is not None and capex is not None
            else None,
            "capex": capex,
            "ebitda": None,
            "cash_conversion": operating / net
            if operating is not None and net is not None and net > 0
            else None,
        },
    }
print(json.dumps(result, ensure_ascii=False, allow_nan=False))
