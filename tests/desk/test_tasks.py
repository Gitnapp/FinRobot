import asyncio
import time

from fastapi.testclient import TestClient

from devtools.fixture_app import FixtureMarket
from finrobot_equity.research_desk.main import create_app
from finrobot_equity.research_desk.store import Store
from finrobot_equity.research_desk.tasks import Tasks


def test_task_receipt_is_immediate_and_deduplicated(tmp_path):
    async def slow_writer(*args):
        await asyncio.sleep(30)
        raise RuntimeError("test cancellation")

    app = create_app(tmp_path, market_factory=FixtureMarket, narrative_writer=slow_writer)
    with TestClient(app) as client:
        start = time.monotonic()
        first = client.post("/api/tasks", json={"kind": "research", "symbol": "NVDA"})
        assert first.status_code == 202 and time.monotonic() - start < 1
        task = first.json()
        assert task["steps"] == ["准备数据", "计算模型", "撰写报告", "整理文件"]
        second = client.post("/api/tasks", json={"kind": "research", "symbol": "NVDA"}).json()
        assert second["id"] == task["id"]
        assert client.get("/api/tasks/" + task["id"]).status_code == 200
        assert any(t["id"] == task["id"] for t in client.get("/api/tasks").json())
        assert client.post("/api/tasks/" + task["id"] + "/retry").status_code == 409


def test_task_progress_tracks_persisted_stages_and_retry(tmp_path):
    store = Store(tmp_path)
    store.init()
    tasks = Tasks(store)
    receipt = tasks.submit("AAPL")
    assert receipt["status"] == "queued" and receipt["queue_position"] == 1
    for stage, completed in [
        ("收集行情与财务", 0),
        ("计算预测模型", 1),
        ("撰写研究报告", 2),
        ("生成报告文件", 3),
    ]:
        store.execute(
            "UPDATE reports SET status='running',stage=? WHERE id=?", (stage, receipt["id"])
        )
        assert tasks.read(receipt["id"])["completed_steps"] == completed
    store.execute(
        "UPDATE reports SET status='failed',error='连接中断' WHERE id=?", (receipt["id"],)
    )
    assert tasks.read(receipt["id"])["error"] == "连接中断"
    retried = tasks.retry(receipt["id"])
    assert retried["id"] == receipt["id"] and retried["status"] == "queued"
    assert retried["error"] is None
    assert store.one("SELECT count(*) AS n FROM reports WHERE symbol='AAPL'")["n"] == 1
    assert store.one("SELECT count(*) AS n FROM reports WHERE status='failed'")["n"] == 0
    # A newly constructed service sees the same durable task.
    assert Tasks(Store(tmp_path)).read(retried["id"])["status"] == "queued"
    store.execute("UPDATE reports SET status='completed' WHERE id=?", (retried["id"],))
    done = tasks.read(retried["id"])
    assert done["completed_steps"] == 4 and done["result_url"] == "/reports/" + retried["id"]
