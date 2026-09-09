import asyncio
import json
import time

import pytest

from finrobot_equity.research_desk.market import Market
from finrobot_equity.research_desk.providers import ProviderError
from finrobot_equity.research_desk.store import Store
from finrobot_equity.research_desk.yahoo import YahooMarket, yahoo_symbol


def test_yahoo_symbol_mapping():
    assert yahoo_symbol("00700.HK") == "0700.HK"
    assert yahoo_symbol("600000.SH") == "600000.SS"
    assert yahoo_symbol("NVDA.US") == "NVDA"
    assert yahoo_symbol("285A.T") == "285A.T"


def test_foreign_quote_and_history_share_same_snapshot(tmp_path):
    store = Store(tmp_path)
    store.init()
    points = [
        {"time": "2026-09-01", "open": 10, "high": 12, "low": 9, "close": 10, "volume": 100},
        {"time": "2026-09-02", "open": 10, "high": 13, "low": 10, "close": 12, "volume": 150},
    ]
    store.execute(
        "INSERT INTO cache VALUES (?,?,?)",
        (
            "yahoo:daily:BESI.AS",
            json.dumps({"name": "Besi", "currency": "EUR", "exchange": "AMS", "points": points}),
            time.time() + 3600,
        ),
    )
    market = Market(store)

    async def stats(symbol):
        return {"marketCap": 1200, "regularMarketTime": 1}

    market.yahoo.statistics = stats

    async def run():
        q, h = await asyncio.gather(market.quote("BESI.AS"), market.price_history("BESI.AS"))
        assert q["source"] == h["source"] == "Yahoo Finance"
        assert q["currency"] == "EUR"
        assert q["market_cap"] == 1200
        assert q["price"] == h["points"][-1]["close"]
        assert q["change_percent"] == pytest.approx(20)
        assert len(h["points"]) == 2
        assert market.price_source("AAPL") is market.tickflow

    asyncio.run(run())


def test_yahoo_cooldown_retains_last_good_without_fake_data(tmp_path):
    store = Store(tmp_path)
    store.init()
    y = YahooMarket(store)
    store.execute(
        "INSERT INTO cache VALUES (?,?,?)", ("yahoo:daily:EXA.PA:retry", "null", time.time() + 900)
    )
    with pytest.raises(ProviderError):
        asyncio.run(y.snapshot("EXA.PA"))
    store.execute(
        "INSERT INTO cache VALUES (?,?,?)",
        (
            "yahoo:daily:EXA.PA",
            json.dumps({"points": [{"time": "2026-09-01", "close": 10}]}),
            time.time() - 10,
        ),
    )
    assert asyncio.run(y.snapshot("EXA.PA"))["stale"]
