"""Last-good snapshots: foreground reads never await upstream network I/O."""

import asyncio
import json
import time
from datetime import datetime, timezone


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

        self.store.execute(
            "UPDATE intelligence_snapshots SET retry_after=0 WHERE error='configuration'"
        )

    def read(self, key, loader, ttl=21600, max_stale=7 * 86400):
        if not self.initialized:
            self.init()
        row = self.store.one("SELECT * FROM intelligence_snapshots WHERE key=?", (key,))
        now = time.time()
        fresh = (
            row
            and row["payload"] is not None
            and row["expires"] > now
            and row["fetched"] is not None
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
        try:
            async with self.gate:
                async with asyncio.timeout(40):
                    payload = await loader()
            encoded = json.dumps(payload, ensure_ascii=False, allow_nan=False)
            now = time.time()
            self.store.execute(
                """INSERT INTO intelligence_snapshots(key,payload,fetched,expires,retry_after,failures,error)
                VALUES (?,?,?,?,0,0,NULL) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,
                fetched=excluded.fetched,expires=excluded.expires,retry_after=0,failures=0,error=NULL""",
                (key, encoded, now, now + ttl),
            )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            # Classify internally, never expose raw exception messages or provider bodies.
            code = "configuration" if isinstance(exc, MissingConfiguration) else "upstream"
            self.store.execute(
                """INSERT INTO intelligence_snapshots(key,retry_after,failures,error) VALUES (?,?,1,?)
                ON CONFLICT(key) DO UPDATE SET retry_after=excluded.retry_after,
                failures=failures+1,error=excluded.error""",
                (key, time.time() + max(900, ttl if code == "configuration" else 0), code),
            )

    async def close(self):
        self.closed = True
        for task in self.tasks.values():
            task.cancel()
        await asyncio.gather(*self.tasks.values(), return_exceptions=True)


class MissingConfiguration(Exception):
    pass
