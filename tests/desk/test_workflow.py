import asyncio
import json
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from finrobot_equity.research_desk.jobs import Worker, enqueue
from finrobot_equity.research_desk.main import create_app
from finrobot_equity.research_desk.market import Market
from finrobot_equity.research_desk.store import Store, now


def setup_store(tmp_path):
    store = Store(tmp_path)
    store.init()
    store.execute(
        "UPDATE settings SET value=?",
        (json.dumps({"provider": "mock", "model": "deterministic-demo", "data_mode": "mock"}),),
    )
    return store


def test_concurrent_enqueue_is_idempotent(tmp_path):
    store = setup_store(tmp_path)
    with ThreadPoolExecutor(max_workers=5) as executor:
        jobs = list(executor.map(lambda _: enqueue(store, "NVDA"), range(10)))
    assert len({j["id"] for j in jobs}) == 1
    assert len(store.reports()) == 1


def test_report_files_and_frozen_model(tmp_path):
    store = setup_store(tmp_path)
    market = Market(store)
    worker = Worker(store, market)
    job = enqueue(store, "NVDA", focus="测试现金流")
    assert asyncio.run(worker.process_one())
    report = store.one("SELECT * FROM reports WHERE id=?", (job["id"],))
    assert report["status"] == "completed", report["error"]
    payload = json.loads(report["payload"])
    assert payload["has_mock_data"] and payload["demo_narrative"]
    assert len(payload["sections"]) == 8
    root = store.reports_dir / job["id"]
    for ext in ("pdf", "html", "md", "json", "csv"):
        assert (root / f"report.{ext}").stat().st_size > 500
    assert (root / "report.pdf").read_bytes().startswith(b"%PDF")
    assert "模拟" in (root / "report.html").read_text()
    assert "营运资金变动" in (root / "report.csv").read_text()
    store.execute(
        "INSERT INTO models VALUES (?,?,?)",
        ("NVDA", json.dumps({"growth": 0.5}), now()),
    )
    assert (
        json.loads(store.one("SELECT payload FROM reports WHERE id=?", (job["id"],))["payload"])[
            "model"
        ]["assumptions"]["growth"]
        == 0.2
    )
    assert enqueue(store, "NVDA")["version"] == 2


def test_schedule_due_pause_and_no_duplicate(tmp_path):
    store = setup_store(tmp_path)
    worker = Worker(store, Market(store))
    for symbol, active in (("NVDA", 1), ("AAPL", 0)):
        store.execute(
            "INSERT INTO coverage(symbol,cadence,active,next_run) VALUES (?,'daily',?,?)",
            (symbol, active, "2020-01-01T00:00:00+00:00"),
        )
    worker.schedule_due()
    worker.schedule_due()
    jobs = store.reports()
    assert len(jobs) == 1
    assert jobs[0]["symbol"] == "NVDA" and jobs[0]["trigger"] == "scheduled"
    assert store.one("SELECT next_run FROM coverage WHERE symbol='NVDA'")["next_run"] > now()
    assert asyncio.run(worker.process_one())
    assert store.one("SELECT last_run FROM coverage WHERE symbol='NVDA'")["last_run"]


def test_restart_marks_interrupted_job_failed(tmp_path):
    store = setup_store(tmp_path)
    job = enqueue(store, "NVDA")
    store.execute("UPDATE reports SET status='running' WHERE id=?", (job["id"],))

    async def restart():
        task = asyncio.create_task(Worker(store, Market(store)).run())
        await asyncio.sleep(0.02)
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    asyncio.run(restart())
    assert store.one("SELECT status FROM reports WHERE id=?", (job["id"],))["status"] == "failed"


def test_due_coverage_coalesces_with_manual_report(tmp_path):
    store = setup_store(tmp_path)
    worker = Worker(store, Market(store))
    enqueue(store, "NVDA")
    store.execute(
        "INSERT INTO coverage(symbol,cadence,active,next_run) VALUES ('NVDA','weekly',1,?)",
        (now(),),
    )
    worker.schedule_due()
    assert asyncio.run(worker.process_one())
    worker.schedule_due()
    assert len(store.reports()) == 1
    assert store.one("SELECT next_run FROM coverage WHERE symbol='NVDA'")["next_run"] > now()


def test_api_validation_settings_and_recoverable_removal(tmp_path):
    app = create_app(tmp_path)
    setup_store(tmp_path)
    with TestClient(app) as client:
        assert client.get("/api/health").json()["ok"]
        assert client.post("/api/assets", json={"symbol": "../../etc"}).status_code == 422
        assert client.post("/api/assets", json={"symbol": "  avgo "}).json()["symbol"] == "AVGO"
        assert client.post("/api/research", json={"symbol": "UNTRACKED"}).status_code == 404
        assert client.put("/api/models/NVDA", json={"gross_margin": 2}).status_code == 422
        base = client.get("/api/models/NVDA").json()
        assert len(base["rows"]) == 20
        assert client.get("/api/models/NVDA?scenario=invalid").status_code == 422
        assert (
            client.put(
                "/api/coverage/NVDA", json={"active": False, "cadence": "weekly"}
            ).status_code
            == 200
        )
        assert client.get("/api/assets/NVDA").json()["coverage"]["active"] == 0
        assert client.get("/api/models/NVDA/export").headers["content-type"].startswith("text/csv")
        settings = client.get("/api/settings").json()
        assert "api_key" not in json.dumps(settings)
        assert (
            client.put(
                "/api/settings",
                json={"provider": "bad", "model": "x", "data_mode": "mock"},
            ).status_code
            == 422
        )
        assert (
            client.post(
                "/api/assets",
                json={"symbol": "TSM"},
                headers={"Origin": "https://evil.example"},
            ).status_code
            == 403
        )
        assert client.delete("/api/coverage/NVDA").status_code == 200
        assert client.delete("/api/assets/AVGO").status_code == 200
        assert client.get("/api/assets/AVGO").status_code == 404


def test_failed_model_is_not_disguised_as_demo(tmp_path, monkeypatch):
    store = setup_store(tmp_path)
    store.execute(
        "UPDATE settings SET value=?",
        (json.dumps({"provider": "openai", "model": "unavailable", "data_mode": "mock"}),),
    )
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    job = enqueue(store, "NVDA")
    asyncio.run(Worker(store, Market(store)).process_one())
    report = store.one("SELECT * FROM reports WHERE id=?", (job["id"],))
    assert report["status"] == "failed" and report["payload"] is None
    assert "未配置密钥" in report["error"]
