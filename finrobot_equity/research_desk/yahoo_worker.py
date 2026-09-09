"""Isolated yfinance process: the parent enforces a hard network deadline."""

import json
import logging
import math
import sys
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import yfinance as yf

logging.getLogger("yfinance").setLevel(logging.CRITICAL)
ticker = yf.Ticker(sys.argv[1])
if len(sys.argv) > 2 and sys.argv[2] == "statistics":
    info = ticker.get_info()
    values = {
        key: info.get(key)
        for key in (
            "trailingPE",
            "beta",
            "fiftyTwoWeekLow",
            "fiftyTwoWeekHigh",
            "marketCap",
            "regularMarketTime",
        )
    }
    values = {
        k: float(v) if v is not None and math.isfinite(float(v)) else None
        for k, v in values.items()
    }
    print(json.dumps(values, allow_nan=False))
    sys.exit(0)
if len(sys.argv) > 2 and sys.argv[2] == "earnings":
    frame = ticker.get_earnings_dates(limit=40)
    events = []
    if frame is not None:
        for at, row in frame.iterrows():

            def value(key):
                raw = row.get(key)
                return float(raw) if raw is not None and math.isfinite(float(raw)) else None

            events.append(
                {
                    "date": at.strftime("%Y-%m-%d"),
                    "eps_estimate": value("EPS Estimate"),
                    "eps_actual": value("Reported EPS"),
                }
            )
    print(json.dumps({"events": events, "source": "Yahoo Finance"}, allow_nan=False))
    sys.exit(0)
if len(sys.argv) > 2 and sys.argv[2] == "financials":
    tables = {
        "income": ticker.get_income_stmt(freq="yearly"),
        "balance": ticker.get_balance_sheet(freq="yearly"),
        "cash": ticker.get_cashflow(freq="yearly"),
    }
    info = ticker.get_info()
    currency = info.get("financialCurrency")
    if not currency or tables["income"].empty:
        raise ValueError("financials_unavailable")
    reports = []
    for period in tables["income"].columns:
        report = {"period": period.strftime("%Y-%m-%d")}
        for name, table in tables.items():
            report[name] = (
                {
                    str(k): float(v)
                    for k, v in table[period].items()
                    if v is not None and math.isfinite(float(v))
                }
                if period in table.columns
                else {}
            )
        reports.append(report)
    print(
        json.dumps(
            {
                "currency": currency,
                "reports": reports,
                "source_url": f"https://finance.yahoo.com/quote/{sys.argv[1]}/financials/",
            },
            allow_nan=False,
        )
    )
    sys.exit(0)
frame = ticker.history(period="max", interval="1d", auto_adjust=True, repair=False, timeout=10)
if frame.empty:
    raise ValueError("empty_history")
metadata = ticker.history_metadata
points = []
for date, row in frame.iterrows():
    values = {key.lower(): float(row[key]) for key in ("Open", "High", "Low", "Close", "Volume")}
    if (
        any(not math.isfinite(v) for v in values.values())
        or min(values[k] for k in ("open", "high", "low", "close")) <= 0
    ):
        continue
    if values["high"] < max(values["open"], values["close"]) or values["low"] > min(
        values["open"], values["close"]
    ):
        continue
    points.append({"time": date.strftime("%Y-%m-%d"), **values})
# A still-open daily bar is not a confirmed closing price.
zone = ZoneInfo(metadata.get("exchangeTimezoneName") or "UTC")
regular_end = metadata.get("currentTradingPeriod", {}).get("regular", {}).get("end")
if (
    points
    and regular_end
    and time.time() < regular_end
    and points[-1]["time"] == datetime.now(zone).date().isoformat()
):
    points.pop()
if not points or not metadata.get("currency"):
    raise ValueError("invalid_history")
print(
    json.dumps(
        {
            "name": metadata.get("longName") or metadata.get("shortName") or sys.argv[1],
            "currency": metadata["currency"],
            "exchange": metadata.get("exchangeName"),
            "points": points,
        },
        allow_nan=False,
    )
)
