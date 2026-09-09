import asyncio
import json
import time

import pytest

from finrobot_equity.research_desk.intelligence.cache import SnapshotCache
from finrobot_equity.research_desk.intelligence.sources import Sources
from finrobot_equity.research_desk.store import Store


def cache(tmp_path):
    store = Store(tmp_path)
    store.init()
    result = SnapshotCache(store)
    result.init()
    return result


def test_reads_are_nonblocking_and_coalesced(tmp_path):
    c = cache(tmp_path)
    calls = []

    async def loader():
        calls.append(1)
        await asyncio.sleep(0.01)
        return {"value": 12}

    async def run():
        responses = [c.read("metric", loader) for _ in range(20)]
        assert all(r["state"] == "pending" for r in responses)
        assert calls == [] and len(c.tasks) == 1
        await asyncio.gather(*list(c.tasks.values()))
        assert c.read("metric", loader)["data"] == {"value": 12}
        assert len(calls) == 1
        await c.close()

    asyncio.run(run())


def test_failed_refresh_preserves_last_good_and_timestamp(tmp_path):
    c = cache(tmp_path)

    async def good():
        return {"value": 42}

    async def bad():
        raise ValueError("secret provider error")

    async def run():
        c.read("metric", good)
        await asyncio.gather(*list(c.tasks.values()))
        first = c.read("metric", good)
        c.store.execute("UPDATE intelligence_snapshots SET expires=0 WHERE key=?", ("metric",))
        assert c.read("metric", bad)["state"] == "stale"
        await asyncio.gather(*list(c.tasks.values()))
        result = c.read("metric", bad)
        assert result["data"] == first["data"] and result["updated_at"] == first["updated_at"]
        assert "secret" not in json.dumps(result)
        assert not c.tasks
        c.store.execute(
            "UPDATE intelligence_snapshots SET fetched=? WHERE key=?",
            (time.time() - 10 * 86400, "metric"),
        )
        assert c.read("metric", bad)["data"] is None
        await c.close()

    asyncio.run(run())


def test_invalid_numeric_payload_never_overwrites_snapshot(tmp_path):
    c = cache(tmp_path)

    async def invalid():
        return {"value": float("nan")}

    async def run():
        c.read("metric", invalid)
        await asyncio.gather(*list(c.tasks.values()))
        assert c.read("metric", invalid) == {
            "state": "unavailable",
            "refreshing": False,
            "refresh_failed": True,
            "data": None,
            "updated_at": None,
        }
        await c.close()

    asyncio.run(run())


def test_akshare_process_is_killed_on_cancellation(monkeypatch):
    class Process:
        returncode = None
        killed = False

        async def communicate(self):
            await asyncio.Future()

        def kill(self):
            self.killed = True
            self.returncode = -9

        async def wait(self):
            return self.returncode

    process = Process()

    async def start(*args, **kwargs):
        return process

    monkeypatch.setattr(asyncio, "create_subprocess_exec", start)

    async def run():
        task = asyncio.create_task(Sources(None).akshare("pmi"))
        await asyncio.sleep(0)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert process.killed

    asyncio.run(run())


def test_edgar_metrics_match_period_and_preserve_missing_values():
    def value(number, end="2025-12-31", filed="2026-02-01"):
        return {
            "val": number,
            "start": end[:4] + "-01-01",
            "end": end,
            "filed": filed,
            "form": "10-K",
        }

    facts = {
        "facts": {
            "us-gaap": {
                "Revenues": {"units": {"USD": [value(100), value(80, "2024-12-31")]}},
                "NetIncomeLoss": {"units": {"USD": [value(10), value(20, filed="2026-03-01")]}},
                "NetCashProvidedByUsedInOperatingActivities": {"units": {"USD": [value(50)]}},
                "PaymentsToAcquirePropertyPlantAndEquipment": {"units": {"USD": [value(15)]}},
            }
        }
    }
    from finrobot_equity.research_desk.financial_data.normalize import sec_reports, derive
    from finrobot_equity.research_desk.financial_data.views import evidence_view
    reports=sec_reports(facts)
    result = evidence_view(derive(reports[0], reports[1]))
    assert result["metrics"]["revenue_growth"] == pytest.approx(0.25)
    assert result["metrics"]["free_cash_flow"] == 35
    assert result["metrics"]["cash_conversion"] == 2.5
    assert result["metrics"]["gross_margin"] is None


def test_http_contract_isolated_from_source_failure(tmp_path):
    from fastapi.testclient import TestClient

    from finrobot_equity.research_desk.main import create_app

    app = create_app(tmp_path)

    async def broken(*args):
        raise RuntimeError("private upstream error body")

    async def good(*args):
        return {"label": "PMI", "unit": "index", "points": [{"date": "2026-08-01", "value": 49.8}]}

    sources = app.state.intelligence.sources
    sources.fred = broken
    sources.akshare = good
    with TestClient(app) as client:
        response = client.get("/api/data/global/macro")
        assert response.status_code == 200

        async def settle():
            await asyncio.gather(*list(app.state.intelligence.cache.tasks.values()))

        client.portal.call(settle)
        response = client.get("/api/data/global/macro")
        data = response.json()
        assert data["us_policy_rate"]["state"] == "unavailable"
        assert data["cn_manufacturing_pmi"]["state"] == "ready"
        assert "private upstream" not in response.text
        assert "FEDFUNDS" not in data


def test_disclosure_history_includes_archives_and_deduplicates(monkeypatch):
    monkeypatch.setenv("SEC_USER_AGENT", "Test test@example.invalid")

    def batch(form, day, accession):
        return {
            "form": [form],
            "filingDate": [day],
            "accessionNumber": [accession],
            "primaryDocument": ["report.htm"],
        }

    recent = batch("10-K", "2025-10-01", "0000000001-25-000001")
    old = batch("8-K", "2010-06-15", "0000000001-10-000001")

    class HTTP:
        async def json(self, source, url, **kwargs):
            if url.endswith("company_tickers.json"):
                return {"0": {"ticker": "TEST", "cik_str": 1}}
            if url.endswith("-001.json"):
                return old
            return {
                "filings": {
                    "recent": recent,
                    "files": [{"name": "CIK0000000001-submissions-001.json"}],
                }
            }

    result = asyncio.run(Sources(HTTP()).disclosures("TEST"))
    assert [r["date"] for r in result["filings"]] == ["2025-10-01", "2010-06-15"]
    assert result["complete"]


def test_large_refresh_queue_completes_without_another_frontend_poll(tmp_path):
    c = cache(tmp_path)
    running = 0
    peak = 0
    done = []

    async def loader(i):
        nonlocal running, peak
        running += 1
        peak = max(peak, running)
        await asyncio.sleep(0.001)
        done.append(i)
        running -= 1
        return {"value": i}

    async def run():
        for i in range(51):
            result = c.read(str(i), lambda n=i: loader(n))
            assert result["refreshing"]
        await asyncio.gather(*list(c.tasks.values()))
        assert len(done) == 51 and peak <= 8
        assert all(c.read(str(i), lambda n=i: loader(n))["state"] == "ready" for i in range(51))
        await c.close()

    asyncio.run(run())


def test_a_share_disclosures_route_without_sec_calls(tmp_path):
    from finrobot_equity.research_desk.intelligence.service import Intelligence
    store = Store(tmp_path)
    store.init()
    service = Intelligence(store)
    service.cache.init()
    calls = []

    async def china(symbol, kind):
        calls.append((symbol, kind))
        return {"currency": "CNY", "period": "2025-12-31", "metrics": {"net_income": 12}, "filings": []}

    async def sec(*args):
        raise AssertionError("A-share must not query SEC")

    service.sources.china = china
    service.sources.edgar = sec
    service.sources.disclosures = sec

    async def run():
        service.company("688256.SH")
        service.disclosures("688256.SH")
        await asyncio.gather(*list(service.cache.tasks.values()))
        assert service.company("688256.SH")["data"]["currency"] == "CNY"
        assert len(calls) == 2
        assert service.company("005930.KS")["data"] is None
        await service.cache.close()
    asyncio.run(run())


def test_shorter_ttl_refreshes_existing_snapshot_without_changing_last_good(tmp_path):
    c = cache(tmp_path)

    async def good():
        return {"value": 42}

    async def unavailable():
        raise RuntimeError("offline")

    async def run():
        await c.refresh("metric", good, 3600)
        c.store.execute("UPDATE intelligence_snapshots SET fetched=? WHERE key='metric'", (time.time() - 120,))
        first = c.read("metric", unavailable, ttl=60)
        assert first["state"] == "stale" and first["data"] == {"value": 42}
        await asyncio.gather(*list(c.tasks.values()))
        after = c.read("metric", unavailable, ttl=60)
        assert after["updated_at"] == first["updated_at"]
        assert after["refresh_failed"] and after["data"] == first["data"]
        await c.close()

    asyncio.run(run())
