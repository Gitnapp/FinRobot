import asyncio
from datetime import date, timedelta

import pytest

from finrobot_equity.research_desk.history import HistoryArchive
from finrobot_equity.research_desk.providers import ProviderError
from finrobot_equity.research_desk.store import Store


class Prices:
    def __init__(self, fail=False):
        self.calls = []
        self.fail = fail

    async def get(self, provider, endpoint, params):
        self.calls.append((endpoint, params))
        if endpoint == "profile":
            return [{"ipoDate": "2010-01-04"}]
        if self.fail:
            raise ProviderError("unavailable")
        return [{"date": params["from"], "open": 2, "high": 3, "low": 1, "close": 2, "volume": 100}]


def test_windows_are_contiguous_bounded_and_cached(tmp_path):
    store = Store(tmp_path)
    store.init()
    p = Prices()
    archive = HistoryArchive(store, p)

    async def run():
        result = await archive.read("AAPL")
        windows = [params for ep, params in p.calls if ep != "profile"]
        assert result["start"] == "2010-01-04"
        for i, w in enumerate(windows):
            assert (date.fromisoformat(w["to"]) - date.fromisoformat(w["from"])).days <= 1460
            if i:
                assert date.fromisoformat(w["from"]) == date.fromisoformat(
                    windows[i - 1]["to"]
                ) + timedelta(days=1)
        count = len(p.calls)
        assert (await archive.read("AAPL")) == result
        assert len(p.calls) == count

    asyncio.run(run())


def test_provider_failure_never_returns_mock_or_partial(tmp_path):
    store = Store(tmp_path)
    store.init()
    with pytest.raises(ProviderError):
        asyncio.run(HistoryArchive(store, Prices(True)).read("AAPL"))
