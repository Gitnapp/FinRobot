"""Last-good snapshots: foreground reads never await upstream network I/O."""

import asyncio
import json
import time
from datetime import datetime, timezone


from ..cache_policy import REFERENCE, UPSTREAM_RETRY_SECONDS, SNAPSHOT_TIMEOUT_SECONDS


class SnapshotCache:
    def __init__(self, store):
        self.store = store
        self.tasks = {}
        self.closed = False
        self.initialized = False
        self.gate = asyncio.Semaphore(8)

    def init(self):
        self.initialized = True
        self.store.execute("""CREATE TABLE IF NOT EXISTS intelligence_snapshots (
            key TEXT PRIMARY KEY, payload TEXT, fetched REAL, expires REAL DEFAULT 0,
            retry_after REAL DEFAULT 0, failures INTEGER DEFAULT 0, error TEXT)""")

        self.store.execute("""CREATE TABLE IF NOT EXISTS data_update_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT, dataset TEXT NOT NULL,
            status TEXT NOT NULL, started REAL NOT NULL, finished REAL, error TEXT)""")
        self.store.execute(
            "UPDATE intelligence_snapshots SET retry_after=0 WHERE error='configuration'"
        )

    def read(self, key, loader, ttl=REFERENCE.ttl, max_stale=REFERENCE.max_stale):
        if not self.initialized:
            self.init()
        row = self.store.one("SELECT * FROM intelligence_snapshots WHERE key=?", (key,))
        now = time.time()
        fresh = (
            row
            and row["payload"] is not None
            and row["expires"] > now
            and row["fetched"] is not None
            and row["fetched"] + ttl > now
            and now - row["fetched"] <= max_stale
        )
        if (
            not fresh
            and not self.closed
            and (not row or row["retry_after"] <= now)
            and key not in self.tasks
        ):
            task = asyncio.create_task(self.refresh(key, loader, ttl))
            self.tasks[key] = task
            task.add_done_callback(lambda _: self.tasks.pop(key, None))
        usable = (
            row
            and row["payload"] is not None
            and row["fetched"] is not None
            and now - row["fetched"] <= max_stale
        )
        return {
            "state": "ready"
            if fresh
            else "stale"
            if usable
            else "pending"
            if key in self.tasks or (not self.closed and (not row or row["retry_after"] <= now))
            else "unavailable",
            "refreshing": key in self.tasks,
            "refresh_failed": bool(row and row["error"]),
            "data": json.loads(row["payload"]) if usable else None,
            "updated_at": datetime.fromtimestamp(row["fetched"], timezone.utc).isoformat()
            if usable
            else None,
        }

    async def refresh(self, key, loader, ttl):
        if not self.initialized:
            self.init()
        with self.store.connection() as db:
            cursor = db.execute(
                "INSERT INTO data_update_runs(dataset,status,started) VALUES (?,'queued',?)",
                (key, time.time()),
            )
            run_id = cursor.lastrowid
            db.execute(
                "DELETE FROM data_update_runs WHERE id < ? AND status NOT IN ('queued','running')",
                (run_id - 2000,),
            )
        try:
            async with self.gate:
                self.store.execute(
                    "UPDATE data_update_runs SET status='running',started=? WHERE id=?",
                    (time.time(), run_id),
                )
                async with asyncio.timeout(SNAPSHOT_TIMEOUT_SECONDS):
                    payload = await loader()
            encoded = json.dumps(payload, ensure_ascii=False, allow_nan=False)
            now = time.time()
            self.store.execute(
                """INSERT INTO intelligence_snapshots(key,payload,fetched,expires,retry_after,failures,error)
                VALUES (?,?,?,?,0,0,NULL) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,
                fetched=excluded.fetched,expires=excluded.expires,retry_after=0,failures=0,error=NULL""",
                (key, encoded, now, now + ttl),
            )
            self.store.execute(
                "UPDATE data_update_runs SET status='completed',finished=? WHERE id=?",
                (time.time(), run_id),
            )
        except asyncio.CancelledError:
            self.store.execute(
                "UPDATE data_update_runs SET status='interrupted',finished=? WHERE id=?",
                (time.time(), run_id),
            )
            raise
        except Exception as exc:
            # Classify internally, never expose raw exception messages or provider bodies.
            code = "configuration" if isinstance(exc, MissingConfiguration) else "upstream"
            self.store.execute(
                "UPDATE data_update_runs SET status='failed',finished=?,error=? WHERE id=?",
                (time.time(), code, run_id),
            )
            self.store.execute(
                """INSERT INTO intelligence_snapshots(key,retry_after,failures,error) VALUES (?,?,1,?)
                ON CONFLICT(key) DO UPDATE SET retry_after=excluded.retry_after,
                failures=failures+1,error=excluded.error""",
                (key, time.time() + max(UPSTREAM_RETRY_SECONDS, ttl if code == "configuration" else 0), code),
            )

    async def close(self):
        self.closed = True
        for task in self.tasks.values():
            task.cancel()
        await asyncio.gather(*self.tasks.values(), return_exceptions=True)


class MissingConfiguration(Exception):
    pass
