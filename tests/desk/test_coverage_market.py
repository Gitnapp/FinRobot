import asyncio

from finrobot_equity.research_desk.coverage_market import CoverageMarket
from finrobot_equity.research_desk.intelligence.cache import SnapshotCache
from finrobot_equity.research_desk.store import Store


def test_quotes_do_not_require_financial_research_enrollment(tmp_path):
    store = Store(tmp_path)
    store.init()
    cache = SnapshotCache(store)
    cache.init()

    class Market:
        calls = 0

        async def quote(self, symbol):
            self.calls += 1
            return {"symbol": symbol, "price": 2, "currency": "USD"}

        async def history(self, symbol):
            return {
                "points": [
                    {"time": "2026-09-01", "open": 1, "high": 2, "low": 1, "close": 1},
                    {"time": "2026-09-02", "open": 1, "high": 2, "low": 1, "close": 2},
                ]
            }

        async def fundamentals(self, symbol):
            raise AssertionError("no financial prerequisite")

    market = Market()
    from finrobot_equity.research_desk.financial_data import FinancialData
    market.financial_data = FinancialData(store,cache,{})
    module = CoverageMarket(store, market, cache)

    async def run():
        result = module.read([{"symbol": "AAPL"}, {"symbol": "AAPL"}, {"symbol": None}])
        assert list(result) == ["AAPL"]
        await asyncio.gather(*list(cache.tasks.values()))
        result = module.read([{"symbol": "AAPL"}])["AAPL"]
        assert result["state"] == "ready"
        assert result["data"]["quote"]["price"] == 2
        assert result["data"]["financials"] is None
        assert market.calls == 1
        await cache.close()

    asyncio.run(run())
