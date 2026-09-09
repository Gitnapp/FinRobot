"""Live market and financial adapters; unavailable facts are never synthesized."""

import json
import time
from datetime import date, datetime, timedelta, timezone

from .financial_data import FinancialData
from .financial_data.providers import (
    ChinaReports,
    FinnhubReports,
    FmpReports,
    SecReports,
    YahooReports,
)
from .intelligence.cache import SnapshotCache
from .intelligence.sources import Sources
from .intelligence.transport import SourceTransport
from .providers import ProviderClient, ProviderError
from .tickflow import TickFlowMarket, currency_for
from .yahoo import YAHOO_MARKETS, YahooMarket

CATALOG = [
    ("NVDA", "NVIDIA", "半导体"),
    ("AAPL", "Apple", "消费电子"),
    ("MSFT", "Microsoft", "软件服务"),
    ("TSLA", "Tesla", "新能源汽车"),
    ("GOOGL", "Alphabet", "互联网"),
    ("AMZN", "Amazon", "电商与云"),
    ("META", "Meta Platforms", "互联网"),
    ("AMD", "Advanced Micro Devices", "半导体"),
    ("AVGO", "Broadcom", "半导体"),
    ("PLTR", "Palantir", "软件服务"),
    ("TSM", "Taiwan Semiconductor", "半导体"),
    ("JPM", "JPMorgan Chase", "金融"),
]


def identity(symbol):
    row = next((r for r in CATALOG if r[0] == symbol), (symbol, symbol, "待分类"))
    return dict(zip(("symbol", "name", "sector"), row))


class Market:
    def __init__(self, store):
        self.store = store
        self.providers = ProviderClient()
        self.tickflow = TickFlowMarket(store, self.providers)
        self.yahoo = YahooMarket(store)
        self.data_cache = SnapshotCache(store)
        self.sources = Sources(SourceTransport())
        self.financial_data = FinancialData(
            store,
            self.data_cache,
            {
                "sec": SecReports(self.sources),
                "finnhub": FinnhubReports(self),
                "yahoo": YahooReports(self.yahoo.financials),
                "fmp": FmpReports(self),
                "china": ChinaReports(self.sources),
            },
        )

    def price_source(self, symbol):
        return self.yahoo if symbol.rsplit(".", 1)[-1] in YAHOO_MARKETS else self.tickflow

    async def instrument(self, symbol):
        return await self.price_source(symbol).instrument(symbol)

    async def price_history(self, symbol):
        return await self.price_source(symbol).history(symbol)

    async def search(self, query):
        if query.upper().rsplit(".", 1)[-1] in YAHOO_MARKETS:
            item = await self.yahoo.instrument(query.upper())
            return [{"symbol": item["symbol"], "name": item["name"], "sector": item["exchange"]}]
        candidates = [
            json.loads(r["payload"])
            for r in self.store.all("SELECT payload FROM coverage_companies")
        ]
        local = [
            {"symbol": r["symbol"], "name": r["name"], "sector": r.get("scene", "")}
            for r in candidates
            if r.get("symbol") and query.lower() in (r["name"] + r["symbol"]).lower()
        ]
        remote = await self.tickflow.search(query)
        return list({r["symbol"]: r for r in local + remote}.values())

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
        try:
            quote = await self.price_source(symbol).quote(symbol)
            match = next((r for r in CATALOG if r[0] == symbol), None)
            if match:
                quote.update(sector=match[2])
            return quote
        except (ProviderError, KeyError, TypeError, ValueError):
            return {
                **identity(symbol),
                "price": None,
                "change_percent": None,
                "market_cap": None,
                "currency": YAHOO_MARKETS.get(symbol.rsplit(".", 1)[-1], currency_for(symbol)),
                "source": "Yahoo Finance"
                if self.price_source(symbol) is self.yahoo
                else "TickFlow",
                "mock": False,
                "as_of": None,
                "note": "行情暂时不可用",
            }

    async def history(self, symbol):
        full = await self.price_history(symbol)
        cutoff = (date.fromisoformat(full["as_of"]) - timedelta(days=365)).isoformat()
        return {**full, "points": [p for p in full["points"] if p["time"] >= cutoff]}

    async def fundamentals(self, symbol):
        return await self.financial_data.model_base(symbol)

    async def news(self, symbol):
        async def fetch(mode):
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
