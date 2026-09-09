"""Explicit offline app; never imported by the production entry point."""

from pathlib import Path

from devtools.fixtures import mock_base, mock_history, mock_quote
from devtools.report_fixture import demo_sections
from finrobot_equity.research_desk.main import create_app
from finrobot_equity.research_desk.market import Market
from finrobot_equity.research_desk.research import TITLES


class FixtureMarket(Market):
    def __init__(self, store):
        super().__init__(store)
        self.tickflow = self
        self.financial_data.providers = {}

    async def instrument(self, symbol):
        return {"symbol": symbol, "name": "测试公司（虚构）", "exchange": "TEST"}

    async def search(self, query):
        return [{"symbol": "TEST", "name": "测试公司（虚构）", "sector": "测试行业"}]

    async def quote(self, symbol):
        return mock_quote(symbol)

    async def history(self, symbol):
        return mock_history(symbol)

    async def fundamentals(self, symbol):
        return mock_base(symbol)

    async def news(self, symbol):
        return {"items": [], "source": "Fixture", "mock": True}

    async def get(self, provider, endpoint, params):
        if endpoint == "stock/metric":
            return {"metric": {"peTTM": 20, "beta": 1, "revenueGrowthTTMYoy": 10}}
        raise RuntimeError("No fixture registered for this endpoint")


async def fixture_narrative(symbol, quote, base, model, news, settings, focus, dossier):
    texts = demo_sections(quote, base, model, dossier)
    texts["appendix"] = "隔离调试数据，不代表真实公司经营表现。" + "\n".join(model["notes"])
    return {
        "sections": [{"title": title, "content": texts[key]} for key, title in TITLES.items()],
        "sources": [],
        "engine": "Fixture",
        "demo_narrative": True,
        "has_mock_data": True,
        "verdict": "调试数据",
    }


if __name__ == "__main__":
    import uvicorn

    directory = Path(".desk-fixture").resolve()
    app = create_app(directory, market_factory=FixtureMarket, narrative_writer=fixture_narrative)
    uvicorn.run(app, host="127.0.0.1", port=8002)
