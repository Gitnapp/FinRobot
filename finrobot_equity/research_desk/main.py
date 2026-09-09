import asyncio
import csv
import io
import json
import logging
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from .assumption_policy import AssumptionPolicy
from .coverage_market import CoverageMarket
from .data_access import DataAccess
from .dossier import compose
from .exports import assumption_text, report_date, table_data
from .intelligence import Intelligence
from .jobs import Worker, enqueue, next_due
from .market import CATALOG, Market
from .model import compute_model, defaults, unavailable_model
from .providers import ProviderError
from .research import call_model, provider_status
from .schemas import (
    Assumptions,
    CoverageInput,
    ResearchInput,
    SettingsInput,
    SymbolInput,
)
from .signals import TrackingSignals
from .store import Store, now
from .watchlists import routes as watchlist_routes

# FinRobot's report module configures root logging. HTTP clients must never log
# request URLs because financial providers carry credentials in query parameters.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


def create_app(directory=None, *, market_factory=Market, narrative_writer=None):
    store = Store(directory)
    market = market_factory(store)
    signals = TrackingSignals(store, market.providers, market.yahoo)
    intelligence = Intelligence(store, market.financial_data, market.sources)
    data_access = DataAccess(market, intelligence, signals)
    coverage_market = CoverageMarket(store, market, intelligence.cache)
    assumption_policy = AssumptionPolicy(store, market, intelligence.cache)
    worker = Worker(store, market, assumption_policy, narrative_writer=narrative_writer)

    @asynccontextmanager
    async def lifespan(app):
        store.init()
        intelligence.cache.init()
        task = asyncio.create_task(worker.run())
        financial_task = asyncio.create_task(market.financial_data.run())
        app.state.worker_task = task
        app.state.financial_task = financial_task
        try:
            yield
        finally:
            for running in (task, financial_task):
                running.cancel()
            for running in (task, financial_task):
                with suppress(asyncio.CancelledError):
                    await running
            await intelligence.cache.close()
            await market.yahoo.close()

    app = FastAPI(title="Garage Research", lifespan=lifespan)

    @app.exception_handler(ProviderError)
    async def unavailable_market(request, exc):
        return JSONResponse(status_code=503, content={"detail": "行情暂时不可用，请稍后重试"})

    app.state.store = store
    app.state.market = market
    app.state.intelligence = intelligence
    app.state.worker = worker
    app.include_router(watchlist_routes(store, market))

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
            "ok": not app.state.worker_task.done() and not app.state.financial_task.done(),
            "scheduler": "running" if not app.state.worker_task.done() else "stopped",
            "last_tick": worker.last_tick,
            "financial_scheduler": "running" if not app.state.financial_task.done() else "stopped",
            "financial_last_tick": market.financial_data.last_tick,
            "time": now(),
        }

    @app.get("/api/data/capabilities")
    def data_capabilities():
        from .capabilities import capability_inventory

        return capability_inventory()

    @app.get("/api/data/{subject}/{dataset}")
    async def read_data(
        subject: str,
        dataset: str,
        fields: str = "",
        start: str | None = None,
        end: str | None = None,
    ):
        try:
            return await data_access.read(
                subject, dataset, fields=fields.split(",") if fields else None, start=start, end=end
            )
        except ValueError:
            raise HTTPException(422, "请检查指标名称或日期范围") from None

    @app.get("/api/catalog")
    async def catalog(q: str = ""):
        if q.strip():
            return await market.search(q.strip())
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
            else store.all(
                "SELECT * FROM assets WHERE symbol IN (SELECT symbol FROM watchlist_symbols) ORDER BY created_at,symbol"
            )
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

    @app.get("/api/coverage-directory")
    def coverage_directory():
        companies = [
            json.loads(r["payload"])
            for r in store.all("SELECT payload FROM coverage_companies ORDER BY rowid")
        ]
        links = {r["symbol"]: r for r in store.all("SELECT * FROM coverage")}
        reports = store.reports()
        represented = {r.get("symbol") for r in companies}
        for symbol in links:
            if symbol not in represented:
                companies.append(
                    {
                        "id": symbol,
                        "name": symbol,
                        "symbol": symbol,
                        "track": "自选",
                        "scene": "其他",
                        "role": "自选",
                        "brief": "",
                        "focus": "",
                        "availability": "ready",
                        "reason": "",
                    }
                )
        for company in companies:
            symbol = company.get("symbol")
            company["coverage"] = links.get(symbol)
            company["report"] = next(
                (r for r in reports if r["symbol"] == symbol and r["status"] == "completed"), None
            )
        return companies

    @app.get("/api/coverage-market")
    async def coverage_quotes():
        return coverage_market.read(coverage_directory())

    @app.get("/api/coverage/{symbol}")
    async def coverage_detail(symbol: str):
        symbol = require_coverage(symbol)
        data = await compose(market, symbol, store.assumptions(symbol))
        if data.get("model"):
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
        base = (
            None
            if symbol.endswith((".SH", ".SZ", ".BJ", ".HK", ".KS", ".KQ", ".T", ".AS", ".PA"))
            else await market.fundamentals(symbol)
        )
        if base:
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
        store.execute(
            "DELETE FROM coverage_companies WHERE json_extract(payload, '$.symbol')=?", (symbol,)
        )
        store.execute("DELETE FROM models WHERE symbol=?", (symbol,))
        return {"ok": True}

    @app.get("/api/models/{symbol}")
    async def get_model(symbol: str, scenario: Literal["base", "bull", "bear"] = "base"):
        symbol = require_coverage(symbol)
        base = await market.fundamentals(symbol)
        if base is None:
            return unavailable_model(scenario)
        recommendation = assumption_policy.read(symbol)
        model = compute_model(base, store.assumptions(symbol), scenario)
        return {**model, "recommendation_state": recommendation["state"]}

    @app.put("/api/models/{symbol}")
    async def save_model(symbol: str, body: dict[str, float | None]):
        try:
            Assumptions.model_validate(
                {**Assumptions().model_dump(), **{k: v for k, v in body.items() if v is not None}}
            )
        except ValueError:
            raise HTTPException(422, "请检查假设数值范围") from None
        symbol = require_coverage(symbol)
        try:
            effective = assumption_policy.save(symbol, body)
        except ValueError:
            raise HTTPException(422, "请检查假设数值范围") from None
        return compute_model(await market.fundamentals(symbol), effective)

    @app.get("/api/models/{symbol}/assumptions")
    async def model_assumptions(symbol: str):
        return assumption_policy.read(require_coverage(symbol))

    @app.get("/api/models/{symbol}/export")
    async def model_export(symbol: str, scenario: Literal["base", "bull", "bear"] = "base"):
        symbol = require_coverage(symbol)
        model = compute_model(
            await market.fundamentals(symbol), store.assumptions(symbol), scenario
        )
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([symbol, model["unit"], scenario])
        writer.writerows(table_data(model))
        writer.writerow(["*", "A为基期，E为预测；隐含每股价格为预测期末名义值，不是当前目标价。"])
        writer.writerow(["*", assumption_text(model)])
        writer.writerow(["[1]", model["source"], model["as_of"]])
        writer.writerow(
            ["[2]", "每股估值＝（企业价值−净债务）÷摊薄股数；金额与股数采用相同百万单位。"]
        )
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
        if body.symbol.endswith((".SH", ".SZ", ".BJ", ".HK", ".KS", ".KQ", ".T", ".AS", ".PA")):
            raise HTTPException(422, "此市场财务研究尚未接入")
        row = enqueue(store, body.symbol, body.focus)
        row.pop("payload", None)
        return row

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
            "sources": [{"name": "Yahoo Finance", "configured": True}]
            + [
                {"name": name, "configured": bool(os.getenv(key))}
                for name, key in [
                    ("FRED", "FRED_API_KEY"),
                    ("JBlanked", "JBLANKED_API_KEY"),
                    ("SEC EDGAR", "SEC_USER_AGENT"),
                    ("TickFlow", "TICKFLOW_API_KEY"),
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
