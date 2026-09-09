import json
from pathlib import Path

from fastapi.testclient import TestClient

from finrobot_equity.research_desk.main import create_app


def test_import_catalog_preserves_unique_companies_and_scenes():
    rows = json.loads(Path("data/coverage-companies.json").read_text())
    assert len(rows) == len({r["id"] for r in rows}) == 101
    assert len({r["scene"] for r in rows}) == 12
    assert all(r["name"] and r["brief"] and r["focus"] for r in rows)
    assert next(r for r in rows if r["name"] == "Cerebras")["symbol"] == "CBRS"
    assert next(r for r in rows if r["name"] == "SK 海力士")["symbol"] == "SKHY"


def test_directory_does_not_depend_on_market_requests(tmp_path):
    app = create_app(tmp_path)

    async def fail(*args):
        raise AssertionError("directory must not call financial providers")

    app.state.market.quote = fail
    with TestClient(app) as client:
        app.state.store.execute(
            "INSERT INTO coverage_companies VALUES (?,?)",
            (
                "private",
                json.dumps(
                    {
                        "id": "private",
                        "name": "Example Company",
                        "symbol": None,
                        "availability": "pending",
                    }
                ),
            ),
        )
        result = client.get("/api/coverage-directory")
        assert result.status_code == 200
        row = result.json()[0]
        assert row["name"] == "Example Company"
        assert row["coverage"] is None and row["report"] is None
        assert "price" not in row
