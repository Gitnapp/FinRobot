import asyncio

from finrobot_equity.research_desk.source_health import SourceHealth, classify
from finrobot_equity.research_desk.schemas import SettingsInput
import pytest
from pydantic import ValidationError


def test_status_classification():
    assert classify(200, {"data": []})[0] == "available"
    for code in (402, 429):
        assert classify(code, {})[0] == "limited"
    for code in (401, 403, 500):
        assert classify(code, {})[0] == "unavailable"
    assert classify(200, {"error": "failed"})[0] == "unavailable"


def test_unconfigured_source_does_not_probe():
    result = asyncio.run(SourceHealth().probe({"name": "Exa", "configured": False}))
    assert result["status"] == "unconfigured"


def test_removed_provider_is_rejected(tmp_path):
    from finrobot_equity.research_desk.store import Store
    from finrobot_equity.research_desk.model_services import ModelServices
    store = Store(tmp_path)
    store.init()
    for provider in ("kimi", "siliconflow"):
        with pytest.raises(ValueError):
            ModelServices(store).resolve({"provider": provider, "model": "test"})


def test_billing_error_with_unauthorized_status_is_limited():
    assert classify(401, {"message": "This endpoint requires credits, and you currently do not have any."}) == ("limited", "额度不足")
    assert classify(401, {"message": "Invalid API key"})[0] == "unavailable"
