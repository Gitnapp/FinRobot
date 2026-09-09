"""Task contract over the durable research queue; HTTP never performs research."""

import json

from .jobs import enqueue
from .store import now

STEPS = ("准备数据", "计算模型", "撰写报告", "整理文件")
STAGES = {"收集行情与财务": 0, "计算预测模型": 1, "撰写研究报告": 2, "生成报告文件": 3}
ORDER = "CASE WHEN trigger='manual' THEN 0 ELSE 1 END,created_at"


class Tasks:
    def __init__(self, store):
        self.store = store

    def view(self, row):
        state = row["status"]
        completed = len(STEPS) if state == "completed" else STAGES.get(row["stage"], 0)
        price = self.store.one(
            "SELECT value FROM cache WHERE key=?", ("price-bundle:" + row["symbol"],)
        )
        name = json.loads(price["value"]).get("quote", {}).get("name") if price else None
        position = None
        if state == "queued":
            queued = self.store.all(
                "SELECT id FROM reports WHERE status='queued' ORDER BY " + ORDER
            )
            position = next((i + 1 for i, r in enumerate(queued) if r["id"] == row["id"]), None)
        return {
            "id": row["id"],
            "kind": "research",
            "title": "生成研报",
            "subject": {
                "symbol": row["symbol"],
                "name": name or row.get("company_name") or "研究报告",
            },
            "status": state,
            "steps": list(STEPS),
            "completed_steps": completed,
            "current_step": STEPS[completed] if state == "running" else None,
            "queue_position": position,
            "created_at": row["created_at"],
            "completed_at": row.get("completed_at"),
            "error": row.get("error"),
            "result_url": "/reports/" + row["id"] if state == "completed" else None,
        }

    def read(self, identifier):
        row = self.store.one(
            "SELECT id,symbol,status,stage,trigger,created_at,completed_at,error FROM reports WHERE id=?",
            (identifier,),
        )
        if not row:
            raise LookupError("task_not_found")
        return self.view(row)

    def list(self):
        rows = self.store.all(
            "SELECT id,symbol,status,stage,trigger,created_at,completed_at,error FROM reports WHERE status IN ('queued','running') ORDER BY "
            + ORDER
        )
        rows += self.store.all(
            "SELECT id,symbol,status,stage,trigger,created_at,completed_at,error FROM reports WHERE status IN ('completed','failed') ORDER BY created_at DESC LIMIT 10"
        )
        return [self.view(row) for row in rows]

    def submit(self, symbol, focus=""):
        return self.read(enqueue(self.store, symbol, focus)["id"])

    def retry(self, identifier):
        with self.store.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT symbol,status FROM reports WHERE id=?", (identifier,)).fetchone()
            if not row:
                raise LookupError("task_not_found")
            if row["status"] != "failed":
                raise ValueError("task_not_failed")
            active = db.execute("SELECT id FROM reports WHERE symbol=? AND status IN ('queued','running')", (row["symbol"],)).fetchone()
            if active:
                raise ValueError("research_already_active")
            db.execute("UPDATE reports SET status='queued',stage='排队中',trigger='manual',created_at=?,completed_at=NULL,error=NULL,payload=NULL WHERE id=?", (now(), identifier))
        return self.read(identifier)
