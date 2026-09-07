import pytest
from pydantic import ValidationError

from finrobot_equity.research_desk.market import mock_base
from finrobot_equity.research_desk.model import compute_model
from finrobot_equity.research_desk.schemas import Assumptions


def values(model):
    return {row["key"]: row["values"] for row in model["rows"]}


def test_twenty_rows_accounting_identity_and_years():
    base = mock_base("NVDA")
    model = compute_model(base)
    rows = values(model)
    assert len(model["rows"]) == 20
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
    assert rows["ev"][:-1] == [None] * 3
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
