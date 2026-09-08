import asyncio
import csv
import io
import json
import logging
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from .dossier import compose
from .exports import report_date, table_data
from .jobs import Worker, enqueue, next_due
from .market import CATALOG, Market
from .model import compute_model, defaults
from .research import call_model, provider_status
from .schemas import (
    Assumptions,
    CoverageInput,
    ResearchInput,
    SettingsInput,
    SymbolInput,
)
from .history import HistoryArchive
from .providers import ProviderError
from .signals import TrackingSignals
from .store import Store, now
from .watchlists import routes as watchlist_routes

# FinRobot's report module configures root logging. HTTP clients must never log
# request URLs because financial providers carry credentials in query parameters.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


def create_app(directory=None):
    store = Store(directory)
    market = Market(store)
    archive = HistoryArchive(store, market.providers)
    signals = TrackingSignals(store, market.providers)
    worker = Worker(store, market)

    @asynccontextmanager
    async def lifespan(app):
        store.init()
        task = asyncio.create_task(worker.run())
        app.state.worker_task = task
        yield
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task

    app = FastAPI(title="Garage Research · FinRobot", lifespan=lifespan)
    app.state.store = store
    app.state.market = market
    app.state.worker = worker
    app.include_router(watchlist_routes(store))

    @app.middleware("http")
    async def local_write_guard(request: Request, call_next):
        # Local MVP: prevent an arbitrary website from issuing cross-origin mutations.
        origin = request.headers.get("origin")
        if request.method in {"POST", "PUT", "PATCH", "DELETE"} and origin:
            from urllib.parse import urlsplit

            if urlsplit(origin).netloc != request.headers.get("host"):
                return Response("Cross-origin write rejected", status_code=403)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    def symbol_checked(symbol):
        try:
            return SymbolInput(symbol=symbol).symbol
        except ValueError:
            raise HTTPException(422, "无效的标的代码") from None

    def require_asset(symbol):
        symbol = symbol_checked(symbol)
        if not store.one("SELECT 1 FROM assets WHERE symbol=?", (symbol,)):
            raise HTTPException(404, "标的不在自选中")
        return symbol

    @app.get("/api/health")
    def health():
        return {
            "ok": not app.state.worker_task.done(),
            "scheduler": "running" if not app.state.worker_task.done() else "stopped",
            "last_tick": worker.last_tick,
            "time": now(),
        }

    @app.get("/api/catalog")
    def catalog(q: str = ""):
        return [
            {"symbol": r[0], "name": r[1], "sector": r[2]}
            for r in CATALOG
            if q.upper() in (r[0] + r[1]).upper()
        ]

    @app.get("/api/assets")
    async def assets(list_id: str | None = None):
        rows = (
            store.all(
                "SELECT a.* FROM assets a JOIN watchlist_symbols w ON a.symbol=w.symbol WHERE w.list_id=? ORDER BY w.position",
                (list_id,),
            )
            if list_id
            else store.all("SELECT * FROM assets ORDER BY created_at,symbol")
        )
        quotes = await asyncio.gather(*(market.quote(r["symbol"]) for r in rows))
        coverage = {r["symbol"]: r for r in store.all("SELECT * FROM coverage")}
        reports = store.reports()
        for quote in quotes:
            symbol = quote["symbol"]
            own = [r for r in reports if r["symbol"] == symbol]
            quote["coverage"] = coverage.get(symbol)
            quote["report_count"] = sum(r["status"] == "completed" for r in own)
            quote["latest_report"] = next((r for r in own if r["status"] == "completed"), None)
            quote["active_job"] = next(
                (r for r in own if r["status"] in ("running", "queued")), None
            )
            quote["last_job"] = own[0] if own else None
        return quotes

    @app.get("/api/assets/{symbol}")
    async def detail(symbol: str):
        symbol = require_asset(symbol)
        data = await compose(market, symbol, store.assumptions(symbol))
        data.pop("model")
        return {
            **data,
            "coverage": store.one("SELECT * FROM coverage WHERE symbol=?", (symbol,)),
            "reports": store.reports(symbol),
        }

    def require_coverage(symbol):
        symbol = require_asset(symbol)
        if not store.one("SELECT 1 FROM coverage WHERE symbol=?", (symbol,)):
            raise HTTPException(404, "请先将标的加入持续跟踪")
        return symbol

    @app.get("/api/coverage/{symbol}")
    async def coverage_detail(symbol: str):
        symbol = require_coverage(symbol)
        data = await compose(market, symbol, store.assumptions(symbol))
        store.execute(
            "INSERT OR IGNORE INTO models VALUES (?,?,?)",
            (symbol, json.dumps(data["model"]["assumptions"]), now()),
        )
        last = store.one(
            "SELECT payload FROM reports WHERE symbol=? AND status='completed' ORDER BY completed_at DESC LIMIT 1",
            (symbol,),
        )
        report = json.loads(last["payload"]) if last else None
        return {
            **data,
            "coverage": store.one("SELECT * FROM coverage WHERE symbol=?", (symbol,)),
            "reports": store.reports(symbol),
            "summary": report["sections"][0]["content"] if report else None,
        }

    @app.get("/api/coverage")
    async def coverage_list():
        return await asyncio.gather(
            *(
                coverage_detail(row["symbol"])
                for row in store.all("SELECT symbol FROM coverage ORDER BY symbol")
            )
        )

    @app.put("/api/coverage/{symbol}")
    async def coverage(symbol: str, body: CoverageInput):
        symbol = require_asset(symbol)
        base = await market.fundamentals(symbol)
        store.execute(
            "INSERT OR IGNORE INTO models VALUES (?,?,?)",
            (symbol, json.dumps(defaults(base)), now()),
        )
        old = store.one("SELECT * FROM coverage WHERE symbol=?", (symbol,))
        # Adding / resuming schedules one initial report; changing frequency resets next due time.
        due = old["next_run"] if old else now()
        if old and (not old["active"] and body.active):
            due = now()
        elif old and old["cadence"] != body.cadence:
            due = next_due(body.cadence)
        if body.active and (not old or not old["active"]):
            if store.one(
                "SELECT 1 FROM reports WHERE symbol=? AND status IN ('queued','running')",
                (symbol,),
            ):
                due = next_due(body.cadence)
        store.execute(
            "INSERT INTO coverage(symbol,cadence,active,next_run) VALUES (?,?,?,?) ON CONFLICT(symbol) DO UPDATE SET cadence=excluded.cadence,active=excluded.active,next_run=excluded.next_run",
            (symbol, body.cadence, int(body.active), due),
        )
        return store.one("SELECT * FROM coverage WHERE symbol=?", (symbol,))

    @app.delete("/api/coverage/{symbol}")
    def remove_coverage(symbol: str):
        symbol = require_asset(symbol)
        store.execute("DELETE FROM coverage WHERE symbol=?", (symbol,))
        store.execute("DELETE FROM models WHERE symbol=?", (symbol,))
        return {"ok": True}

    @app.get("/api/models/{symbol}")
    async def get_model(symbol: str, scenario: Literal["base", "bull", "bear"] = "base"):
        symbol = require_coverage(symbol)
        return compute_model(await market.fundamentals(symbol), store.assumptions(symbol), scenario)

    @app.put("/api/models/{symbol}")
    async def save_model(symbol: str, body: Assumptions):
        symbol = require_coverage(symbol)
        store.execute(
            "INSERT OR REPLACE INTO models VALUES (?,?,?)",
            (symbol, body.model_dump_json(), now()),
        )
        return compute_model(await market.fundamentals(symbol), body.model_dump())

    @app.get("/api/models/{symbol}/export")
    async def model_export(symbol: str, scenario: Literal["base", "bull", "bear"] = "base"):
        symbol = require_coverage(symbol)
        model = compute_model(
            await market.fundamentals(symbol), store.assumptions(symbol), scenario
        )
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([symbol, "USD million", model["source"], scenario])
        writer.writerows(table_data(model))
        writer.writerow(["assumptions", json.dumps(model["assumptions"])])
        return Response(
            "\ufeff" + buf.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{symbol}-model-{scenario}.csv"'
            },
        )

    @app.post("/api/research", status_code=202)
    def research(body: ResearchInput):
        require_asset(body.symbol)
        row = enqueue(store, body.symbol, body.focus)
        row.pop("payload", None)
        return row

    @app.get("/api/assets/{symbol}/history")
    async def full_history(symbol: str):
        try:
            return await archive.read(symbol_checked(symbol))
        except ProviderError:
            raise HTTPException(503, "完整历史暂不可用，请稍后重试") from None

    @app.get("/api/assets/{symbol}/signals/{kind}")
    async def tracking_signals(symbol: str, kind: Literal["catalysts", "sentiment"]):
        return await signals.read(symbol_checked(symbol), kind)

    @app.get("/api/reports")
    def reports(symbol: str | None = None):
        return store.reports(symbol_checked(symbol) if symbol else None)

    @app.get("/api/reports/{identifier}")
    def report(identifier: str):
        row = store.one("SELECT * FROM reports WHERE id=?", (identifier,))
        if not row:
            raise HTTPException(404, "报告不存在")
        row["payload"] = json.loads(row["payload"]) if row["payload"] else None
        return row

    @app.get("/api/reports/{identifier}/download/{extension}")
    def download(identifier: str, extension: Literal["html", "md", "pdf", "json", "csv"]):
        row = store.one("SELECT * FROM reports WHERE id=?", (identifier,))
        if not row or row["status"] != "completed":
            raise HTTPException(404, "报告文件尚未就绪")
        filename = store.reports_dir / row["id"] / f"report.{extension}"
        if not filename.is_file():
            raise HTTPException(404, "报告文件缺失")
        return FileResponse(
            filename, filename=f"{row['symbol']}-research-{report_date(row)}.{extension}"
        )

    @app.get("/api/settings")
    def settings():
        import os

        return {
            **store.settings(),
            "providers": provider_status(),
            "sources": [
                {"name": name, "configured": bool(os.getenv(key))}
                for name, key in [
                    ("Finnhub", "FINNHUB_API_KEY"),
                    ("FMP", "FMP_API_KEY"),
                    ("Tavily", "TAVILY_API_KEY"),
                    ("Exa", "EXA_API_KEY"),
                ]
            ],
        }

    @app.put("/api/settings")
    def save_settings(body: SettingsInput):
        store.execute("UPDATE settings SET value=? WHERE id=1", (body.model_dump_json(),))
        return settings()

    @app.post("/api/settings/test")
    async def test_settings(body: SettingsInput):
        if body.provider == "mock":
            return {"ok": True, "message": "演示引擎可用"}
        try:
            await call_model(body.model_dump(), [{"role": "user", "content": "Reply OK only"}], 12)
            return {"ok": True, "message": "模型连接成功"}
        except RuntimeError as exc:
            raise HTTPException(502, str(exc)) from None

    @app.post("/api/market/refresh")
    def refresh():
        store.execute("DELETE FROM cache")
        return {"ok": True}

    dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    # parents[2] is finrobot_equity's parent, the repository root.
    if dist.exists():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="frontend-assets")

        @app.get("/{rest:path}", include_in_schema=False)
        def frontend(rest: str):
            if rest.startswith("api/"):
                raise HTTPException(404, "接口不存在")
            return FileResponse(dist / "index.html")

    return app


app = create_app()
