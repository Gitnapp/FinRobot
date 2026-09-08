"""FMP / Finnhub adapters with explicit demo provenance and a bounded request cache."""

import asyncio
import hashlib
import json
import math
import random
import time
from datetime import date, datetime, timedelta, timezone

from .providers import ProviderClient, ProviderError

CATALOG = [
    ("NVDA", "NVIDIA", "半导体", 230.36, 0.84, 130497),
    ("AAPL", "Apple", "消费电子", 319.97, -2.51, 391035),
    ("MSFT", "Microsoft", "软件服务", 499.70, -2.04, 281724),
    ("TSLA", "Tesla", "新能源汽车", 354.08, -5.92, 97690),
    ("GOOGL", "Alphabet", "互联网", 205.10, 1.24, 350018),
    ("AMZN", "Amazon", "电商与云", 215.30, 0.67, 637959),
    ("META", "Meta Platforms", "互联网", 645.20, -1.15, 164501),
    ("AMD", "Advanced Micro Devices", "半导体", 145.30, 2.18, 25785),
    ("AVGO", "Broadcom", "半导体", 357.90, 0.21, 51574),
    ("PLTR", "Palantir", "软件服务", 174.31, -4.50, 2866),
    ("TSM", "Taiwan Semiconductor", "半导体", 205, 1.31, 90000),
    ("JPM", "JPMorgan Chase", "金融", 280, 0.52, 180000),
]


def identity(symbol):
    row = next(
        (r for r in CATALOG if r[0] == symbol),
        (symbol, symbol, "待分类", 100, 0, 10000),
    )
    return dict(zip(("symbol", "name", "sector", "price", "change_percent", "revenue"), row))


def mock_base(symbol, reason="演示财务数据"):
    item = identity(symbol)
    rev = item["revenue"]
    return {
        "year": 2025,
        "revenue": rev,
        "cogs": rev * 0.60,
        "opex": rev * 0.20,
        "da": rev * 0.05,
        "interest": rev * 0.02,
        "tax": rev * 0.03,
        "capex": rev * 0.06,
        "nwc": rev * 0.02,
        "growth": None,
        "source": "Demo · " + reason,
        "as_of": "2025-12-31",
        "mock": True,
    }


def mock_quote(symbol, reason="演示行情"):
    item = identity(symbol)
    return {
        **item,
        "market_cap": item["revenue"] * 1e6 * 12,
        "source": "Demo",
        "mock": True,
        "as_of": "2026-09-04T20:00:00+00:00",
        "note": reason,
        "currency": "USD",
    }


def mock_history(symbol):
    rng = random.Random(int(hashlib.sha256(symbol.encode()).hexdigest()[:10], 16))
    points = []
    start = date(2025, 9, 4)
    value = identity(symbol)["price"] * 0.64
    for i in range(366):
        day = start + timedelta(days=i)
        if day.weekday() > 4:
            continue
        opening = value
        value = max(1, value * (1 + rng.uniform(-0.035, 0.043)))
        points.append(
            {
                "time": day.isoformat(),
                "open": opening,
                "close": value,
                "high": max(opening, value) * (1 + rng.random() * 0.014),
                "low": min(opening, value) * (1 - rng.random() * 0.014),
            }
        )
    scale = identity(symbol)["price"] / points[-1]["close"]
    for point in points:
        for key in ("open", "close", "high", "low"):
            point[key] = round(point[key] * scale, 2)
    return {
        "points": points,
        "source": "Demo",
        "mock": True,
        "as_of": points[-1]["time"],
        "note": "固定种子的模拟走势，不代表历史价格",
    }


class Market:
    def __init__(self, store):
        self.store = store
        self.providers = ProviderClient()

    async def get(self, provider, endpoint, params):
        return await self.providers.get(provider, endpoint, params)

    async def cached(self, key, fetch, ttl=900):
        mode = self.store.settings()["data_mode"]
        cache_key = f"{mode}:{key}"
        row = self.store.one("SELECT value,expires FROM cache WHERE key=?", (cache_key,))
        if row and row["expires"] > time.time():
            return json.loads(row["value"])
        value = await fetch(mode)
        self.store.execute(
            "INSERT OR REPLACE INTO cache VALUES (?,?,?)",
            (cache_key, json.dumps(value), time.time() + ttl),
        )
        return value

    async def quote(self, symbol):
        async def fetch(mode):
            if mode == "mock":
                return mock_quote(symbol, "设置中已选择演示数据")
            errors = []
            # Finnhub's free quote endpoint avoids spending FMP's small daily allowance on the watchlist.
            for provider in ("Finnhub", "FMP"):
                try:
                    data = await self.get(provider, "quote", {"symbol": symbol})
                    row = data if provider == "Finnhub" else data[0]
                    price = row.get("c") if provider == "Finnhub" else row.get("price")
                    if not price or not math.isfinite(float(price)) or float(price) <= 0:
                        raise ProviderError(f"{provider} 无有效报价")
                    ts = row.get("t") if provider == "Finnhub" else row.get("timestamp")
                    profile = await self.profile(symbol) if provider == "Finnhub" else {}
                    return {
                        "symbol": symbol,
                        "name": row.get("name", identity(symbol)["name"]),
                        "sector": identity(symbol)["sector"],
                        "price": float(price),
                        "change_percent": float(row.get("dp") or 0)
                        if provider == "Finnhub"
                        else float(row.get("changePercentage") or 0),
                        "market_cap": row.get("marketCap") or profile.get("market_cap"),
                        "source": provider,
                        "mock": False,
                        "as_of": datetime.fromtimestamp(ts, timezone.utc).isoformat()
                        if ts
                        else None,
                        "note": "供应商报价；时间为供应商数据时间，可能为最近收盘价",
                        "currency": "USD",
                    }
                except (
                    ProviderError,
                    KeyError,
                    TypeError,
                    ValueError,
                    IndexError,
                ) as exc:
                    errors.append(
                        str(exc) if isinstance(exc, ProviderError) else f"{provider} 数据不完整"
                    )
            return mock_quote(symbol, "；".join(errors))

        return await self.cached("quote:" + symbol, fetch, 300)

    async def profile(self, symbol):
        async def fetch(mode):
            if mode == "mock":
                return {}
            try:
                row = await self.get("Finnhub", "stock/profile2", {"symbol": symbol})
                cap = float(row["marketCapitalization"]) * 1e6
                if not math.isfinite(cap) or cap <= 0:
                    return {}
                return {"market_cap": cap}
            except (ProviderError, KeyError, ValueError, TypeError):
                return {}

        return await self.cached("profile:" + symbol, fetch, 21600)

    async def history(self, symbol):
        async def fetch(mode):
            demo = mock_history(symbol)
            if mode == "mock":
                return demo
            try:
                data = await self.get(
                    "FMP",
                    "historical-price-eod/full",
                    {
                        "symbol": symbol,
                        "from": (
                            datetime.now(timezone.utc).date() - timedelta(days=365)
                        ).isoformat(),
                    },
                )
                points = [
                    {
                        "time": r["date"],
                        **{k: float(r[k]) for k in ("open", "high", "low", "close")},
                    }
                    for r in data
                ]
                points = sorted({p["time"]: p for p in points}.values(), key=lambda p: p["time"])
                if len(points) < 2:
                    raise ProviderError("FMP 历史走势不足")
                return {
                    "points": points,
                    "source": "FMP",
                    "mock": False,
                    "as_of": points[-1]["time"],
                    "note": "历史日线 OHLC，来源 FMP",
                }
            except (ProviderError, KeyError, ValueError, TypeError):
                demo["note"] = "FMP 历史行情不可用或受套餐限制，显示模拟走势"
                return demo

        return await self.cached("history:" + symbol, fetch, 3600)

    async def fundamentals(self, symbol):
        async def fetch(mode):
            if mode == "mock":
                return mock_base(symbol)
            try:
                income, cash = await asyncio.gather(
                    self.get(
                        "FMP",
                        "income-statement",
                        {"symbol": symbol, "period": "annual", "limit": 2},
                    ),
                    self.get(
                        "FMP",
                        "cash-flow-statement",
                        {"symbol": symbol, "period": "annual", "limit": 2},
                    ),
                )
                row = max(income, key=lambda r: r["date"])
                if row.get("reportedCurrency") != "USD":
                    raise ProviderError("财务报表币种不是 USD，不混用币种")
                flow = next(r for r in cash if r["date"] == row["date"])
                # Reuse FinRobot's existing annual-statement normalization.
                import pandas as pd

                from finrobot_equity.core.src.modules.financial_data_processor import (
                    extract_historical_metrics_from_api_data,
                )

                prepared = [
                    {**r, "year": int(r.get("fiscalYear") or r["date"][:4])} for r in income
                ]
                metrics = extract_historical_metrics_from_api_data(
                    {"income_statement": pd.DataFrame(prepared)}
                )
                year = int(row.get("fiscalYear") or row["date"][:4])
                revenue = float(metrics.loc[metrics.metrics == "Revenue", f"{year}A"].iloc[0]) / 1e6

                # Align cash-flow D&A and EBITDA, avoiding duplicate D&A in operating expenses.
                def number(mapping, key):
                    value = float(mapping[key]) / 1e6
                    if not math.isfinite(value):
                        raise ValueError(key)
                    return value

                cogs = number(row, "costOfRevenue")
                da = number(flow, "depreciationAndAmortization")
                ebit = number(row, "operatingIncome")
                return {
                    "year": year,
                    "revenue": revenue,
                    "cogs": cogs,
                    "opex": revenue - cogs - ebit - da,
                    "da": da,
                    "interest": abs(number(row, "interestExpense")),
                    "tax": number(row, "incomeTaxExpense"),
                    "capex": abs(number(flow, "capitalExpenditure")),
                    "nwc": number(flow, "changeInWorkingCapital"),
                    "growth": None,
                    "source": "FMP annual statements · FinRobot normalization",
                    "mock": False,
                    "as_of": row["date"],
                }
            except (
                ProviderError,
                KeyError,
                TypeError,
                ValueError,
                IndexError,
                StopIteration,
            ):
                return mock_base(symbol, "FMP 财务接口不可用、字段不全或套餐受限")

        return await self.cached("fundamentals:" + symbol, fetch, 21600)

    async def news(self, symbol):
        async def fetch(mode):
            if mode == "mock":
                return {
                    "items": [],
                    "source": "Demo",
                    "mock": True,
                    "note": "演示模式不生成虚构新闻",
                }
            try:
                items = await self.get(
                    "Finnhub",
                    "company-news",
                    {
                        "symbol": symbol,
                        "from": (datetime.now(timezone.utc).date() - timedelta(days=7)).isoformat(),
                        "to": datetime.now(timezone.utc).date().isoformat(),
                    },
                )
                news = [
                    {
                        "title": r["headline"],
                        "url": r["url"],
                        "source": r["source"],
                        "date": datetime.fromtimestamp(r["datetime"], timezone.utc).isoformat(),
                        "summary": r.get("summary", "")[:1500],
                    }
                    for r in items[:6]
                    if r.get("url", "").startswith("https://")
                ]
                return {
                    "items": news,
                    "source": "Finnhub",
                    "mock": False,
                    "note": "近 7 日新闻；原文为外部资料",
                }
            except (ProviderError, KeyError, TypeError, ValueError):
                return {
                    "items": [],
                    "source": "Finnhub",
                    "mock": False,
                    "note": "新闻源暂不可用，报告会披露信息缺口",
                }

        return await self.cached("news:" + symbol, fetch, 3600)
