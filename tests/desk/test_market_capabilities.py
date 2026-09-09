import asyncio

import pytest

from devtools.fixture_app import FixtureMarket
from finrobot_equity.research_desk.dossier import compose
from finrobot_equity.research_desk.store import Store


@pytest.mark.parametrize('symbol', ['005930.KS','00700.HK','688256.SH','002156.SZ','285A.T','BESI.AS','EXA.PA'])
def test_financial_capability_does_not_depend_on_market(tmp_path, symbol):
    store = Store(tmp_path)
    store.init()
    market = FixtureMarket(store)
    async def run():
        dossier = await compose(market, symbol)
        assert not dossier.get('market_only')
        assert dossier['model'] and dossier['valuation']
        await market.peers.cache.close()
        await market.data_cache.close()
        await market.yahoo.close()
    asyncio.run(run())
