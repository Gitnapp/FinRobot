import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from finrobot_equity.research_desk.providers import ProviderError
from finrobot_equity.research_desk.store import Store
from finrobot_equity.research_desk.tickflow import (
    TickFlowMarket,
    currency_for,
    decode_bars,
    wire_symbol,
)


def columnar(timestamps):
    return {
        "timestamp": timestamps,
        **{
            k: [v] * len(timestamps)
            for k, v in [("open", 2), ("high", 3), ("low", 1), ("close", 2), ("volume", 100)]
        },
    }


class Prices:
    def __init__(self, fail=False):
        self.calls = []
        self.fail = fail

    async def get(self, provider, endpoint, params):
        self.calls.append(params)
        if endpoint == "instruments":
            return {"data": [{"symbol": "AAPL.US", "name": "Apple", "ext": {}}]}
        if self.fail:
            raise ProviderError("unavailable")
        start = datetime(1980, 1, 3, tzinfo=timezone.utc)
        if "end_time" not in params:
            times = [int((start + timedelta(days=i)).timestamp() * 1000) for i in range(10000)]
        else:
            assert params["end_time"] == int(start.timestamp() * 1000) - 1
            times = [int((start - timedelta(days=i)).timestamp() * 1000) for i in [2, 1]]
        return {"data": columnar(times)}


def test_full_history_pages_and_shared_cache(tmp_path):
    store = Store(tmp_path)
    store.init()
    provider = Prices()
    market = TickFlowMarket(store, provider)

    async def run():
        first, second = await asyncio.gather(market.history("AAPL"), market.history("AAPL"))
        assert first == second
        assert len(first["points"]) == 10002
        assert len(provider.calls) == 3
        assert first["currency"] == "USD"
        await market.history("AAPL")
        assert len(provider.calls) == 3

    asyncio.run(run())


def test_history_failure_never_returns_synthetic_bars(tmp_path):
    store = Store(tmp_path)
    store.init()
    with pytest.raises(ProviderError):
        asyncio.run(TickFlowMarket(store, Prices(True)).history("AAPL"))


def test_exchange_dates_and_currency():
    raw = columnar([1788796800000])
    assert decode_bars(raw, "600000.SH")[0]["time"] == "2026-09-08"
    assert wire_symbol("AAPL") == "AAPL.US"
    assert wire_symbol("00700.HK") == "00700.HK"
    assert currency_for("00700.HK") == "HKD"
    assert currency_for("600000.SH") == "CNY"
    raw["close"] = []
    with pytest.raises(ProviderError):
        decode_bars(raw, "600000.SH")


def test_paid_quote_contract_uses_native_currency(tmp_path, monkeypatch):
    monkeypatch.setenv("TICKFLOW_API_KEY", "test-only")

    class Paid:
        async def get(self, provider, endpoint, params):
            if endpoint == "instruments":
                return {
                    "data": [
                        {
                            "symbol": "00700.HK",
                            "name": "腾讯控股",
                            "exchange": "HK",
                            "ext": {"total_shares": 100},
                        }
                    ]
                }
            assert endpoint == "quotes"
            return {
                "data": [
                    {
                        "symbol": "00700.HK",
                        "last_price": 420,
                        "prev_close": 400,
                        "timestamp": 1788796800000,
                    }
                ]
            }

    store = Store(tmp_path)
    store.init()
    quote = asyncio.run(TickFlowMarket(store, Paid()).quote("00700.HK"))
    assert quote["currency"] == "HKD"
    assert quote["price"] == 420
    assert quote["change_percent"] == pytest.approx(5)
    assert quote["price_kind"] == "realtime"


def test_history_http_route_uses_tickflow_adapter(tmp_path):
    from fastapi.testclient import TestClient

    from finrobot_equity.research_desk.main import create_app

    app = create_app(tmp_path)

    async def history(symbol):
        assert symbol == "00700.HK"
        return {
            "currency": "HKD",
            "points": [{"time": "2026-09-01", "close": 10}],
            "source": "TickFlow",
        }

    app.state.market.tickflow.history = history
    with TestClient(app) as client:
        response = client.get("/api/data/00700.HK/prices")
        assert response.status_code == 200
        assert response.json()["data"]["currency"] == "HKD"


def test_market_preserves_canonical_security_name(tmp_path):
    from finrobot_equity.research_desk.market import Market

    store = Store(tmp_path)
    store.init()
    market = Market(store)

    async def quote(symbol):
        return {"symbol": symbol, "name": "Apple Inc.", "sector": "NASDAQ"}

    market.tickflow.quote = quote
    result = asyncio.run(market.quote("AAPL"))
    assert result["name"] == "Apple Inc."
    assert result["symbol"] == "AAPL"


def test_daily_prices_refresh_after_five_minutes(tmp_path, monkeypatch):
    """A newer close must replace cached bars without an hour-long wait."""
    monkeypatch.delenv("TICKFLOW_API_KEY", raising=False)
    clock = [1000.0]
    monkeypatch.setattr("finrobot_equity.research_desk.tickflow.time.time", lambda: clock[0])

    class UpdatingPrices:
        def __init__(self):
            self.day = 8

        async def get(self, provider, endpoint, params):
            if endpoint == "instruments":
                return {"data": [{"symbol": "AAPL.US", "name": "Apple", "exchange": "US", "ext": {}}]}
            stamp = datetime(2026, 9, self.day, 4, tzinfo=timezone.utc)
            return {"data": columnar([int(stamp.timestamp() * 1000)])}

    store = Store(tmp_path)
    store.init()
    source = UpdatingPrices()
    market = TickFlowMarket(store, source)

    async def run():
        assert (await market.quote("AAPL"))["as_of"] == "2026-09-08"
        source.day = 9
        clock[0] += 301
        quote = await market.quote("AAPL")
        history = await market.history("AAPL")
        assert quote["as_of"] == history["as_of"] == "2026-09-09"

    asyncio.run(run())
