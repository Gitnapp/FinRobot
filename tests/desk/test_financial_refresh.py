import asyncio
import json
import time
from contextlib import suppress

from finrobot_equity.research_desk.financial_data import FinancialData
from finrobot_equity.research_desk.intelligence.cache import SnapshotCache
from finrobot_equity.research_desk.store import Store, now
from tests.desk.test_financial_data import reports


async def startup_scan(data):
    runner = asyncio.create_task(data.run())
    await asyncio.sleep(0)
    assert data.last_tick is not None
    await asyncio.gather(*list(data.cache.tasks.values()))
    runner.cancel()
    with suppress(asyncio.CancelledError):
        await runner


def test_background_cadence_pause_restart_and_user_values(tmp_path):
    store = Store(tmp_path)
    store.init()
    cache = SnapshotCache(store)
    cache.init()
    for symbol, cadence, active in [
        ("AAPL", "daily", 1),
        ("NVDA", "weekly", 1),
        ("MSFT", "daily", 0),
    ]:
        store.execute(
            "INSERT INTO coverage(symbol,cadence,active) VALUES (?,?,?)", (symbol, cadence, active)
        )
    store.execute("INSERT INTO assumption_overrides VALUES (?,?)", ("AAPL", '{"growth":0.31}'))
    store.execute("INSERT INTO models VALUES (?,?,?)", ("AAPL", '{"growth":0.31}', now()))
    original = store.all("SELECT * FROM models")

    class Source:
        calls = []

        async def load(self, symbol):
            self.calls.append(symbol)
            return reports()

    source = Source()
    data = FinancialData(store, cache, {"sec": source})

    async def run():
        # No frontend request: startup alone loads every active symbol.
        await startup_scan(data)
        assert sorted(source.calls) == ["AAPL", "NVDA"]
        for symbol, days in [("AAPL", 1), ("NVDA", 7)]:
            row = store.one(
                "SELECT * FROM intelligence_snapshots WHERE key=?", ("financial-metrics:" + symbol,)
            )
            assert round(row["expires"] - row["fetched"]) == days * 86400
        # A new cache/runner respects persisted successful timestamps.
        restarted = FinancialData(store, SnapshotCache(store), {"sec": source})
        await startup_scan(restarted)
        assert len(source.calls) == 2
        # Shortening weekly to daily catches up without visiting a page.
        store.execute("UPDATE coverage SET cadence='daily' WHERE symbol='NVDA'")
        store.execute(
            "UPDATE intelligence_snapshots SET fetched=? WHERE key='financial-metrics:NVDA'",
            (time.time() - 2 * 86400,),
        )
        await startup_scan(restarted)
        assert source.calls.count("NVDA") == 2
        assert store.all("SELECT * FROM models") == original
        assert json.loads(
            store.one("SELECT values_json FROM assumption_overrides")["values_json"]
        ) == {"growth": 0.31}
        await restarted.cache.close()
        await cache.close()

    asyncio.run(run())


def test_background_failure_keeps_last_good_and_coalesces(tmp_path):
    store = Store(tmp_path)
    store.init()
    store.execute("INSERT INTO coverage(symbol,cadence,active) VALUES ('AAPL','daily',1)")
    cache = SnapshotCache(store)
    cache.init()
    payload = json.dumps(
        {
            "fields": {"revenue": {"value": 123}},
            "period": "2025-09-28",
            "currency": "USD",
            "start": "2024-09-29",
        }
    )
    store.execute(
        "INSERT INTO intelligence_snapshots(key,payload,fetched,expires) VALUES (?,?,?,0)",
        ("financial-metrics:AAPL", payload, time.time() - 2 * 86400),
    )

    class Failing:
        calls = 0

        async def load(self, symbol):
            self.calls += 1
            await asyncio.sleep(0)
            raise RuntimeError("offline")

    provider = Failing()
    data = FinancialData(store, cache, {"sec": provider})

    async def run():
        runner = asyncio.create_task(data.run())
        await asyncio.sleep(0)
        foreground = await data.get("AAPL")
        assert foreground["data"]["fields"]["revenue"]["value"] == 123
        await asyncio.gather(*list(cache.tasks.values()))
        runner.cancel()
        with suppress(asyncio.CancelledError):
            await runner
        await startup_scan(data)
        assert provider.calls == 1  # One request, then persisted retry backoff.
        row = store.one("SELECT * FROM intelligence_snapshots")
        assert row["payload"] == payload and row["failures"] == 1
        assert row["retry_after"] > time.time()
        assert data.read("AAPL")["refresh_failed"]
        await cache.close()

    asyncio.run(run())
