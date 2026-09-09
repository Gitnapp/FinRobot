import asyncio
import json

import pytest

from finrobot_equity.research_desk import assumption_advisor as advisor
from devtools.fixtures import mock_base
from finrobot_equity.research_desk.schemas import Assumptions


class Market:
    async def fundamentals(self, symbol):
        return {**mock_base(symbol), "mock": False}


from finrobot_equity.research_desk.store import Store as DatabaseStore


class Store(DatabaseStore):
    def __init__(self, directory):
        super().__init__(directory)
        self.init()

    def settings(self):
        return {"provider": "openai", "model": "test"}

    def assumptions(self, symbol):
        return Assumptions().model_dump()


def test_proposal_is_complete_validated_and_read_only(monkeypatch, tmp_path):
    values = Assumptions(growth=0.12).model_dump()

    async def answer(*args):
        return json.dumps(
            {"assumptions": values, "rationale": {k: "基于财务基期的审慎假设" for k in values}}
        )

    monkeypatch.setattr(advisor, "call_model", answer)
    result = asyncio.run(advisor.propose(Market(), Store(tmp_path), "AAPL"))
    assert result["assumptions"]["growth"] == 0.12
    assert len(result["rationale"]) == 9


@pytest.mark.parametrize("change", ["missing", "out_of_range", "missing_reason"])
def test_invalid_ai_output_is_rejected(monkeypatch, change, tmp_path):
    values = Assumptions().model_dump()
    reasons = {k: "基于财务基期的审慎假设" for k in values}
    if change == "missing":
        values.pop("share_growth")
    if change == "out_of_range":
        values["growth"] = 9
    if change == "missing_reason":
        reasons.pop("share_growth")

    async def answer(*args):
        return json.dumps({"assumptions": values, "rationale": reasons})

    monkeypatch.setattr(advisor, "call_model", answer)
    with pytest.raises(ValueError):
        asyncio.run(advisor.propose(Market(), Store(tmp_path), "AAPL"))
