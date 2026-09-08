"""SQLite-backed queue + in-process scheduler. Run one local application worker."""

import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone

from .dossier import compose
from .exports import export_files
from .research import write_narrative
from .store import now


def next_due(cadence):
    return (datetime.now(timezone.utc) + timedelta(days=1 if cadence == "daily" else 7)).isoformat(
        timespec="seconds"
    )


def enqueue(store, symbol, focus="", trigger="manual"):
    with store.connection() as db:
        db.execute("BEGIN IMMEDIATE")
        active = db.execute(
            "SELECT * FROM reports WHERE symbol=? AND status IN ('queued','running')",
            (symbol,),
        ).fetchone()
        if active:
            return dict(active)
        identifier = uuid.uuid4().hex
        version = db.execute(
            "SELECT COALESCE(MAX(version),0)+1 FROM reports WHERE symbol=?", (symbol,)
        ).fetchone()[0]
        db.execute(
            "INSERT INTO reports(id,symbol,version,status,stage,trigger,focus,created_at) VALUES (?,?,?,'queued','排队中',?,?,?)",
            (identifier, symbol, version, trigger, focus, now()),
        )
        return dict(db.execute("SELECT * FROM reports WHERE id=?", (identifier,)).fetchone())


class Worker:
    def __init__(self, store, market):
        self.store = store
        self.market = market
        self.last_tick = None

    def schedule_due(self):
        self.last_tick = now()
        with self.store.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            for coverage in db.execute(
                "SELECT * FROM coverage WHERE active=1 AND next_run<=?", (now(),)
            ).fetchall():
                symbol = coverage["symbol"]
                busy = db.execute(
                    "SELECT 1 FROM reports WHERE symbol=? AND status IN ('queued','running')",
                    (symbol,),
                ).fetchone()
                if busy:
                    # An in-flight manual report satisfies this due slot too.
                    db.execute(
                        "UPDATE coverage SET next_run=? WHERE symbol=?",
                        (next_due(coverage["cadence"]), symbol),
                    )
                    continue
                identifier = uuid.uuid4().hex
                version = db.execute(
                    "SELECT COALESCE(MAX(version),0)+1 FROM reports WHERE symbol=?",
                    (symbol,),
                ).fetchone()[0]
                db.execute(
                    "INSERT INTO reports(id,symbol,version,status,stage,trigger,focus,created_at) VALUES (?,?,?,'queued','排队中','scheduled','',?)",
                    (identifier, symbol, version, now()),
                )
                db.execute(
                    "UPDATE coverage SET next_run=? WHERE symbol=?",
                    (next_due(coverage["cadence"]), symbol),
                )

    async def process_one(self):
        with self.store.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute(
                "SELECT * FROM reports WHERE status='queued' ORDER BY created_at LIMIT 1"
            ).fetchone()
            if not row:
                return False
            job = dict(row)
            db.execute(
                "UPDATE reports SET status='running',stage='收集行情与财务' WHERE id=?",
                (job["id"],),
            )
        try:
            symbol = job["symbol"]
            settings = self.store.settings()
            dossier = await compose(self.market, symbol, self.store.assumptions(symbol))
            quote, base, news = dossier["quote"], dossier["fundamentals"], dossier["news"]
            self.store.execute("UPDATE reports SET stage='计算预测模型' WHERE id=?", (job["id"],))
            model = dossier["model"]
            self.store.execute("UPDATE reports SET stage='撰写研究报告' WHERE id=?", (job["id"],))
            narrative = await write_narrative(
                symbol, quote, base, model, news, settings, job["focus"], dossier
            )
            payload = {
                "id": job["id"],
                "symbol": symbol,
                "version": job["version"],
                "created_at": now(),
                "quote": quote,
                "financial_base": base,
                "history": dossier["history"],
                "technical": dossier["technical"],
                "valuation": dossier["valuation"],
                "peers": dossier["peers"],
                "model": model,
                "focus": job["focus"],
                "trigger": job["trigger"],
                **narrative,
            }
            self.store.execute("UPDATE reports SET stage='生成报告文件' WHERE id=?", (job["id"],))
            await asyncio.to_thread(export_files, payload, self.store.reports_dir / job["id"])
            with self.store.connection() as db:
                db.execute(
                    "UPDATE reports SET status='completed',stage='已完成',payload=?,completed_at=? WHERE id=?",
                    (json.dumps(payload, ensure_ascii=False), now(), job["id"]),
                )
                db.execute("UPDATE coverage SET last_run=? WHERE symbol=?", (now(), symbol))
        except asyncio.CancelledError:
            self.store.execute(
                "UPDATE reports SET status='failed',stage='已中断',error='服务关闭时任务被中断，可手动重试' WHERE id=?",
                (job["id"],),
            )
            raise
        except Exception as exc:
            message = (
                str(exc) if isinstance(exc, RuntimeError) else "研究任务未完成，请检查数据或重试"
            )
            self.store.execute(
                "UPDATE reports SET status='failed',stage='生成失败',error=? WHERE id=?",
                (message, job["id"]),
            )
        return True

    async def run(self):
        # A process restart never leaves a phantom running job. Queued jobs resume normally.
        self.store.execute(
            "UPDATE reports SET status='failed',stage='已中断',error='上次运行被中断，可手动重试' WHERE status='running'"
        )
        while True:
            self.schedule_due()
            if not await self.process_one():
                await asyncio.sleep(2)
