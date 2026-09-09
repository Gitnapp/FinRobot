import asyncio
from types import SimpleNamespace

from finrobot_equity.research_desk.diagnostics import Diagnostics
from finrobot_equity.research_desk.intelligence.cache import SnapshotCache
from finrobot_equity.research_desk.store import Store


def test_update_logs_do_not_expose_upstream_exception_body(tmp_path):
    store = Store(tmp_path)
    store.init()
    cache = SnapshotCache(store)

    async def failing():
        raise ValueError("private-provider-response")

    asyncio.run(cache.refresh("financial-metrics:NVDA", failing, 60))
    log = Diagnostics(store, None).logs()["items"][0]
    assert log["status"] == "failed" and log["finished"] >= log["started"]
    assert log["error"] == "upstream"
    assert "private-provider-response" not in str(log)


def test_plans_are_derived_from_active_coverage_and_snapshot_schedule(tmp_path):
    store = Store(tmp_path)
    store.init()
    cache = SnapshotCache(store)
    cache.init()
    store.execute(
        "INSERT INTO coverage(symbol,cadence,active,next_run) VALUES ('NVDA','daily',1,'2026-10-01')"
    )
    store.execute(
        "INSERT INTO intelligence_snapshots(key,fetched,expires) VALUES ('financial-metrics:NVDA',100,9999999999)"
    )
    market = SimpleNamespace(data_cache=cache, peers=SimpleNamespace(cache=cache))
    plans = Diagnostics(store, market).plans()["items"]
    financial = next(p for p in plans if p["id"] == "financial-metrics:NVDA")
    assert financial["status"] == "scheduled" and financial["next_run"] == 9999999999
    assert financial["last_success"] == 100
