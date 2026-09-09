import asyncio
import json
from datetime import datetime, timezone

from finrobot_equity.research_desk.providers import ProviderError
from finrobot_equity.research_desk.signals import TrackingSignals
from finrobot_equity.research_desk.store import Store


class Provider:
    def __init__(self, value):
        self.value = value
        self.calls = 0

    async def get(self, *args):
        self.calls += 1
        await asyncio.sleep(0.01)
        if isinstance(self.value, Exception):
            raise self.value
        return self.value


def service(tmp_path, value):
    store = Store(tmp_path)
    store.init()
    store.execute(
        "UPDATE settings SET value=? WHERE id=1",
        (json.dumps({**store.settings(), "data_mode": "auto"}),),
    )
    return TrackingSignals(store, Provider(value))


def test_parallel_requests_share_one_call(tmp_path):
    s = service(tmp_path, {"ticker": "AAPL", "found": True, "mentions": 12})

    async def run():
        result = await asyncio.gather(*(s.read("AAPL", "sentiment") for _ in range(8)))
        assert all(r["status"] == "ready" for r in result)
        assert s.providers.calls == 1
        assert (await s.read("AAPL", "sentiment"))["data"]["score"] is None
        assert s.providers.calls == 1

    asyncio.run(run())


def test_failure_is_cached_without_fake_metrics(tmp_path):
    s = service(tmp_path, ProviderError("access_denied"))

    async def run():
        result = await s.read("AAPL", "sentiment")
        assert result["status"] == "unavailable"
        assert result["data"] is None
        await s.read("AAPL", "sentiment")
        assert s.providers.calls == 1

    asyncio.run(run())


def test_stale_keeps_timestamp_and_expires(tmp_path):
    s = service(tmp_path, ProviderError("unavailable"))
    key = "signals:auto:AAPL:sentiment"
    old = {
        "status": "ready",
        "as_of": datetime.now(timezone.utc).isoformat(),
        "data": {"score": 0.2},
        "reason": None,
    }
    s.store.execute("INSERT OR REPLACE INTO cache VALUES (?,?,?)", (key, json.dumps(old), 0))
    result = asyncio.run(s.read("AAPL", "sentiment"))
    assert result["status"] == "stale" and result["as_of"] == old["as_of"]
    old["as_of"] = "2020-01-01T00:00:00+00:00"
    s.store.execute("INSERT OR REPLACE INTO cache VALUES (?,?,?)", (key, json.dumps(old), 0))
    assert asyncio.run(s.read("AAPL", "sentiment"))["data"] is None


def test_malformed_metrics_do_not_break_calendar(tmp_path):
    s = service(tmp_path, {"ticker": "AAPL", "sentiment_score": float("nan")})
    assert asyncio.run(s.read("AAPL", "sentiment"))["status"] == "unavailable"
    s.providers.value = {"earningsCalendar": []}
    assert asyncio.run(s.read("AAPL", "catalysts"))["data"]["events"] == []


def test_calendar_deduplicates_and_filters_symbol(tmp_path):
    today = datetime.now(timezone.utc).date().isoformat()
    event = {"symbol": "AAPL", "date": today, "epsEstimate": 1.2, "quarter": 3}
    s = service(tmp_path, {"earningsCalendar": [event, event, {**event, "symbol": "MSFT"}]})
    events = asyncio.run(s.read("AAPL", "catalysts"))["data"]["events"]
    assert len(events) == 1
    assert events[0]["upcoming"] and events[0]["timing"] == "时间待定"


def test_provider_limits_and_redacts_errors(monkeypatch):
    import httpx

    from finrobot_equity.research_desk.providers import ProviderClient

    calls = []

    def handle(request):
        calls.append(request)
        return httpx.Response(429, text="sensitive body must never reach UI")

    original = httpx.AsyncClient
    monkeypatch.setenv("ADANOS_API_KEY", "test-credential")
    monkeypatch.setattr(
        httpx, "AsyncClient", lambda **kw: original(transport=httpx.MockTransport(handle), **kw)
    )

    async def run():
        provider = ProviderClient()
        for _ in range(2):
            try:
                await provider.get("Adanos", "reddit/stocks/v1/stock/AAPL", {})
                assert False, "expected rate limit"
            except ProviderError as exc:
                assert str(exc) == "rate_limited"
        assert len(calls) == 1
        assert calls[0].headers["X-API-Key"] == "test-credential"
        assert "test-credential" not in str(calls[0].url)

    asyncio.run(run())


def test_hong_kong_identifier_is_normalized_and_response_checked(tmp_path):
    s = service(tmp_path, {"ticker": "0700", "found": True, "sentiment_score": 0.189})
    calls = []
    original = s.providers.get

    async def capture(*args):
        calls.append(args)
        return await original(*args)

    s.providers.get = capture
    result = asyncio.run(s.read("00700.HK", "sentiment"))
    assert result["status"] == "ready"
    assert result["data"]["score"] == 0.189
    assert calls[0][1] == "reddit/stocks/v1/stock/0700"
    s.providers.value = {"ticker": "XIACY", "found": True, "sentiment_score": 0.8}
    assert asyncio.run(s.read("01810.HK", "sentiment"))["status"] == "unavailable"


def test_supported_hong_kong_without_mentions_is_empty(tmp_path):
    s = service(tmp_path, {"ticker": "1810", "found": False})
    assert asyncio.run(s.read("01810.HK", "sentiment"))["status"] == "empty"
