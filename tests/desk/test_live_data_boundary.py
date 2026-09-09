import asyncio

from finrobot_equity.research_desk.dossier import basic_metrics
from finrobot_equity.research_desk.market import Market
from finrobot_equity.research_desk.providers import ProviderError
from finrobot_equity.research_desk.store import Store


def test_missing_provider_data_never_becomes_fake_financials(tmp_path):
    store = Store(tmp_path)
    store.init()
    market = Market(store)

    async def fail(*args):
        raise ProviderError("unavailable")

    market.get = fail
    market.yahoo.statistics=fail
    class Unavailable:
        load=staticmethod(fail)
    market.financial_data.providers={"sec":Unavailable()}

    async def run():
        assert await market.fundamentals("NVDA") is None
        metrics = await basic_metrics(market, "NVDA")
        assert metrics["pe"] is None and metrics["beta"] is None
        assert not metrics["mock"]

    asyncio.run(run())
