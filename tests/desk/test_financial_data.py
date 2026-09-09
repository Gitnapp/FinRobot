import asyncio
import copy
import json
from pathlib import Path

from finrobot_equity.research_desk.financial_data import FinancialData
from finrobot_equity.research_desk.financial_data.normalize import metric, sec_reports
from finrobot_equity.research_desk.intelligence.cache import SnapshotCache
from finrobot_equity.research_desk.model import compute_model
from finrobot_equity.research_desk.store import Store


def reports():
    return sec_reports(json.loads(Path("tests/desk/fixtures/sec-qcom-fy2025.json").read_text()))


def test_interface_returns_sec_facts_and_model_uses_reported_profit(tmp_path):
    store = Store(tmp_path)
    store.init()
    cache = SnapshotCache(store)

    class SEC:
        calls = 0

        async def load(self, symbol):
            self.calls += 1
            await asyncio.sleep(0.001)
            return reports()

    source = SEC()
    data = FinancialData(store, cache, {"sec": source})

    async def run():
        income, cash = await asyncio.gather(
            data.get("QCOM", ["revenue", "net_income"]), data.get("QCOM", ["operating_cash_flow"])
        )
        assert source.calls == 1
        assert income["data"]["fields"]["revenue"]["value"] == 44284000000
        assert income["data"]["fields"]["net_income"]["value"] == 5541000000
        assert cash["data"]["fields"]["operating_cash_flow"]["value"] == 14012000000
        full = (await data.get("QCOM"))["data"]
        assert full["fields"]["capex"]["value"] == 1192000000
        assert full["fields"]["total_debt"]["value"] == 14811000000
        assert full["fields"]["net_debt"]["value"] == 9291000000
        model = compute_model(await data.model_base("QCOM"))
        base = {r["key"]: r["values"][0] for r in model["rows"]}
        assert base["net_income"] == 5541
        assert base["fcf"] == 12820
        assert base["nwc"] is None
        assert base["shares"] == 1105
        assert full["fields"]["net_income"]["provider"] == "SEC EDGAR"
        assert full["fields"]["free_cash_flow"]["status"] == "derived"
        await cache.close()

    asyncio.run(run())


def test_resolution_rejects_wrong_period_currency_and_duration():
    anchor = reports()[0]
    anchor["fields"].pop("capex", None)
    supplements = []
    for end, currency, start, val in [
        (anchor["period"], "CNY", anchor["start"], 1),
        ("2024-09-29", "USD", None, 2),
        (anchor["period"], "USD", "2025-07-01", 3),
        (anchor["period"], "USD", anchor["start"], 1192000000),
    ]:
        supplements.append(
            {
                "period": end,
                "start": start,
                "currency": currency,
                "fields": {
                    "capex": metric(val, "other", "capex", "https://example.org", end, currency)
                },
            }
        )
    result = FinancialData.resolve([anchor, *supplements], anchor)
    assert result["fields"]["capex"]["value"] == 1192000000
    assert result["fields"]["capex"]["provider"] == "other"
    assert result["fields"]["working_capital_change"]["value"] is None


def test_sec_selector_does_not_accept_quarters_as_years():
    raw = json.loads(Path("tests/desk/fixtures/sec-qcom-fy2025.json").read_text())
    row = {
        "end": "2026-06-30",
        "start": "2026-04-01",
        "val": 999,
        "form": "10-Q",
        "filed": "2026-08-01",
    }
    raw["facts"]["us-gaap"]["Revenues"]["units"]["USD"].append(row)
    assert reports()[0]["period"] == sec_reports(raw)[0]["period"] == "2025-09-28"


def test_field_supplementation_through_interface_keeps_provenance(tmp_path):
    store = Store(tmp_path)
    store.init()
    cache = SnapshotCache(store)
    first = copy.deepcopy(reports())
    first[0]["fields"].pop("capex")
    calls = []

    class Primary:
        async def load(self, symbol):
            calls.append("primary")
            return first

    class Supplement:
        async def load(self, symbol):
            calls.append("supplement")
            r = copy.deepcopy(first[0])
            r["fields"] = {
                "capex": metric(
                    1192000000,
                    "supplement",
                    "capex",
                    "https://example.org",
                    r["period"],
                    r["currency"],
                    start=r["start"],
                )
            }
            return [r]

    data = FinancialData(store, cache, {"sec": Primary(), "yahoo": Supplement()})

    async def run():
        result = (await data.get("QCOM", ["revenue", "capex", "free_cash_flow"]))["data"]["fields"]
        assert result["revenue"]["provider"] == "SEC EDGAR"
        assert result["capex"]["provider"] == "supplement"
        assert result["free_cash_flow"]["value"] == 12820000000
        assert calls == ["primary", "supplement"]
        await cache.close()

    asyncio.run(run())


def test_public_metric_endpoint_and_unknown_field(tmp_path):
    from fastapi.testclient import TestClient

    from finrobot_equity.research_desk.main import create_app

    app = create_app(tmp_path)

    class Source:
        async def load(self, symbol):
            return reports()

    app.state.market.financial_data.providers = {"sec": Source()}
    with TestClient(app) as client:
        r = client.get("/api/data/QCOM/metrics?fields=revenue,net_income")
        assert r.status_code == 200 and set(r.json()["data"]["fields"]) == {"revenue", "net_income"}
        assert client.get("/api/data/QCOM/metrics?fields=made_up").status_code == 422
        assert client.get("/api/data/capabilities").status_code == 200
        assert client.get("/api/context/company/QCOM").status_code == 404


def test_split_da_combines_cashflow_components_without_double_counting():
    raw = json.loads(Path("tests/desk/fixtures/sec-amd-fy2025.json").read_text())
    annual = sec_reports(raw)
    result = FinancialData.resolve(annual, annual[0])
    fields = result["fields"]
    assert fields["depreciation_amortization"]["value"] == 3004000000
    assert fields["ebitda"]["value"] == 6698000000
    assert len(fields["depreciation_amortization"]["sources"]) == 2
    assert all(s["provider"] == "SEC EDGAR" for s in fields["depreciation_amortization"]["sources"])
    # Missing components stay missing; a disclosed total takes precedence over components.
    partial = copy.deepcopy(annual[0])
    partial["fields"].pop("amortization_adjustment")
    assert FinancialData.resolve([partial], partial)["fields"]["ebitda"]["value"] is None
    annual[0]["fields"]["depreciation_amortization"] = metric(
        3004000000, "SEC EDGAR", "total", "https://www.sec.gov", "2025-12-27", "USD"
    )
    assert FinancialData.resolve(annual, annual[0])["fields"]["ebitda"]["value"] == 6698000000
