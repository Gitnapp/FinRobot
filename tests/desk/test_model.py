import pytest
from pydantic import ValidationError

from devtools.fixtures import mock_base
from finrobot_equity.research_desk.model import compute_model
from finrobot_equity.research_desk.schemas import Assumptions


def values(model):
    return {row["key"]: row["values"] for row in model["rows"]}


def test_model_accounting_identity_and_years():
    base = mock_base("NVDA")
    model = compute_model(base)
    rows = values(model)
    assert len(model["rows"]) == 24
    assert model["columns"] == ["2025A", "2026E", "2027E", "2028E"]
    assert rows["revenue"][-1] == pytest.approx(base["revenue"] * 1.2**3)
    for year in range(4):
        assert rows["gross_profit"][year] == pytest.approx(
            rows["revenue"][year] - rows["cogs"][year]
        )
        assert rows["ebitda"][year] == pytest.approx(
            rows["gross_profit"][year] - rows["opex"][year]
        )
        assert rows["net_income"][year] == pytest.approx(
            rows["ebit"][year] - rows["interest"][year] - rows["tax"][year]
        )
        assert rows["fcf"][year] == pytest.approx(
            rows["net_income"][year] + rows["da"][year] - rows["capex"][year] - rows["nwc"][year]
        )
    assert rows["ev"][0] is None
    assert rows["ev"][1] == pytest.approx(rows["ebitda"][1] * 15)
    assert rows["ev"][-1] == pytest.approx(rows["ebitda"][-1] * 15)


def test_scenarios_and_loss_making_business():
    base = mock_base("AAPL")
    bull = values(compute_model(base, scenario="bull"))
    bear = values(compute_model(base, scenario="bear"))
    assert bull["revenue"][-1] > bear["revenue"][-1]
    assert bull["ev"][-1] > bear["ev"][-1]
    loss = values(compute_model(base, Assumptions(opex_ratio=0.9).model_dump()))
    assert loss["ebitda"][-1] < 0
    assert loss["tax"][-1] == 0
    assert loss["ev"][-1] is None


@pytest.mark.parametrize(
    "invalid",
    [
        {"growth": float("nan")},
        {"gross_margin": 1.1},
        {"exit_multiple": 0},
        {"tax_rate": -0.1},
        {"unexpected": 1},
    ],
)
def test_invalid_assumptions_rejected(invalid):
    with pytest.raises(ValidationError):
        Assumptions(**invalid)


def test_peer_bars_use_zero_baseline_for_fair_magnitude_comparison():
    from reportlab.graphics.charts.barcharts import VerticalBarChart

    from finrobot_equity.research_desk.charts import bars

    drawing = bars("Peers", ["A", "B", "C"], [[27.4, 44.5, 121.2]], ["P/E"])
    chart = next(item for item in drawing.contents if isinstance(item, VerticalBarChart))
    assert chart.valueAxis.valueMin == 0
    assert chart.valueAxis.valueMax > 121.2


def test_equity_bridge_and_dilution():
    base = {**mock_base("AAPL"), "shares": 1000, "net_debt": 5000}
    model = compute_model(base, Assumptions(share_growth=0.1).model_dump())
    r = values(model)
    for i in range(1, 4):
        assert r["shares"][i] == pytest.approx(1000 * 1.1**i)
        assert r["equity_value"][i] == pytest.approx(r["ev"][i] - 5000)
        assert r["price"][i] == pytest.approx(r["equity_value"][i] / r["shares"][i])
    absent = values(compute_model(mock_base("AAPL")))
    assert absent["price"] == [None] * 4
    negative = values(compute_model({**base, "net_debt": 1e12}))
    assert negative["equity_value"][-1] < 0
    assert negative["price"][-1] is None


def test_unavailable_model_keeps_every_field_without_inventing_values():
    from finrobot_equity.research_desk.model import ROWS, unavailable_model
    model = unavailable_model()
    assert [r["key"] for r in model["rows"]] == [r[0] for r in ROWS]
    assert all(r["values"] == [None] * 4 for r in model["rows"])
    assert model["assumptions"] is None
