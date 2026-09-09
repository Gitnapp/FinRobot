"""Read-only scheduling diagnostics. Logs contain classifications, never provider bodies."""

import json
import time


class Diagnostics:
    def __init__(self, store, market):
        self.store, self.market = store, market

    def plans(self):
        active = self.store.all("SELECT symbol,cadence,next_run FROM coverage WHERE active=1")
        peers = set()
        for row in active:
            custom = self.store.one(
                "SELECT symbols FROM peer_selections WHERE symbol=?", (row["symbol"],)
            )
            saved = self.store.one(
                "SELECT payload FROM intelligence_snapshots WHERE key=?",
                ("peer-list:" + row["symbol"],),
            )
            members = (
                json.loads(custom["symbols"])
                if custom
                else json.loads(saved["payload"]).get("members", [])
                if saved and saved["payload"]
                else []
            )
            peers.update(p["symbol"] for p in members)
        keys = (
            {("financial-metrics", r["symbol"]) for r in active}
            | {("peer-list", r["symbol"]) for r in active}
            | {("peer-row", s) for s in peers}
            | {("financial-metrics", s) for s in peers}
        )
        running = set(self.market.data_cache.tasks) | set(self.market.peers.cache.tasks)
        labels = {"financial-metrics": "财务数据", "peer-list": "同业名单", "peer-row": "同业行情"}
        result = []
        for kind, symbol in sorted(keys):
            key = kind + ":" + symbol
            row = (
                self.store.one(
                    "SELECT fetched,expires,retry_after,error FROM intelligence_snapshots WHERE key=?",
                    (key,),
                )
                or {}
            )
            due = max(row.get("expires") or 0, row.get("retry_after") or 0)
            result.append(
                {
                    "id": key,
                    "symbol": symbol,
                    "dataset": labels[kind],
                    "next_run": due or time.time(),
                    "last_success": row.get("fetched"),
                    "status": "running"
                    if key in running
                    else "retry"
                    if row.get("error")
                    else "due"
                    if due <= time.time()
                    else "scheduled",
                    "error": row.get("error"),
                }
            )
        for row in active:
            result.append(
                {
                    "id": "research:" + row["symbol"],
                    "symbol": row["symbol"],
                    "dataset": "跟踪周期",
                    "next_run": row["next_run"],
                    "last_success": None,
                    "status": "scheduled",
                    "error": None,
                }
            )
        return {"items": result, "checked_at": time.time()}

    def logs(self, before=None):
        rows = self.store.all(
            "SELECT * FROM data_update_runs"
            + (" WHERE id<?" if before else "")
            + " ORDER BY id DESC LIMIT 50",
            (before,) if before else (),
        )
        return {"items": rows, "next_cursor": rows[-1]["id"] if len(rows) == 50 else None}
