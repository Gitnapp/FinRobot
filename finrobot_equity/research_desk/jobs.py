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
    def __init__(self, store, market, assumption_policy=None, *, narrative_writer=None):
        self.store = store
        self.market = market
        self.narrative_writer = narrative_writer or write_narrative
        self.assumption_policy = assumption_policy
        self.last_tick = None

    def schedule_due(self):
        self.last_tick = now()
        with self.store.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            for coverage in db.execute(
                "SELECT * FROM coverage WHERE active=1 AND next_run<=? AND EXISTS (SELECT 1 FROM models WHERE models.symbol=coverage.symbol)",
                (now(),),
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
                company = next(
                    (
                        json.loads(r["payload"])
                        for r in db.execute("SELECT payload FROM coverage_companies").fetchall()
                        if json.loads(r["payload"]).get("symbol") == symbol
                    ),
                    None,
                )
                focus = (
                    (
                        company["scene"]
                        + "；"
                        + company["brief"]
                        + "；重点核验："
                        + company["focus"]
                    )[:1200]
                    if company
                    else ""
                )
                db.execute(
                    "INSERT INTO reports(id,symbol,version,status,stage,trigger,focus,created_at) VALUES (?,?,?,'queued','排队中','scheduled',?,?)",
                    (identifier, symbol, version, focus, now()),
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
            if self.assumption_policy:
                await self.assumption_policy.refresh(symbol)
            dossier = await compose(self.market, symbol, self.store.assumptions(symbol))
            if dossier.get("market_only"):
                raise RuntimeError("财务数据尚未接入，暂不能生成研究报告")
            quote, base, news = dossier["quote"], dossier["fundamentals"], dossier["news"]
            self.store.execute("UPDATE reports SET stage='计算预测模型' WHERE id=?", (job["id"],))
            model = dossier["model"]
            self.store.execute("UPDATE reports SET stage='撰写研究报告' WHERE id=?", (job["id"],))
            narrative = await self.narrative_writer(
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

    async def refresh_market_due(self):
        rows = self.store.all(
            "SELECT * FROM coverage WHERE active=1 AND next_run<=? AND NOT EXISTS (SELECT 1 FROM models WHERE models.symbol=coverage.symbol)",
            (now(),),
        )
        for row in rows:
            symbol = row["symbol"]
            try:
                async with asyncio.timeout(30):
                    quote, history = await asyncio.gather(
                        self.market.quote(symbol), self.market.history(symbol)
                    )
                    if quote.get("price") is None or not history.get("points"):
                        raise RuntimeError("Market data unavailable")
                self.store.execute(
                    "UPDATE coverage SET last_run=?,next_run=? WHERE symbol=? AND active=1",
                    (now(), next_due(row["cadence"]), symbol),
                )
            except (RuntimeError, ValueError, TimeoutError):
                retry = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
                self.store.execute("UPDATE coverage SET next_run=? WHERE symbol=?", (retry, symbol))

    async def run(self):
        # A process restart never leaves a phantom running job. Queued jobs resume normally.
        self.store.execute(
            "UPDATE reports SET status='failed',stage='已中断',error='上次运行被中断，可手动重试' WHERE status='running'"
        )
        while True:
            await self.refresh_market_due()
            self.schedule_due()
            if not await self.process_one():
                await asyncio.sleep(2)
