"""Application data interface. Domain modules own provider selection and normalization."""

import json

from .dossier import compose
from .model import compute_model, unavailable_model
from .providers import ProviderError
from .schemas import SymbolInput


class DataAccess:
    def __init__(self, market, intelligence, signals, assumptions):
        self.market, self.intelligence, self.signals = market, intelligence, signals
        self.assumptions = assumptions

    async def read(
        self,
        subject,
        dataset,
        *,
        fields=None,
        start=None,
        end=None,
        context="stocks",
        scenario="base",
        report_id=None,
    ):
        if dataset in {"macro", "calendar"}:
            if dataset == "macro":
                return self.intelligence.macro()
            return self.intelligence.calendar(start, end)
        if dataset == "research" and self.market.store.one(
            "SELECT id FROM coverage_companies WHERE id=?", (subject,)
        ):
            return self.intelligence.research(subject)
        symbol = SymbolInput(symbol=subject).symbol
        if dataset == "report":
            row = self.market.store.one(
                "SELECT * FROM reports WHERE id=? AND symbol=?", (report_id, symbol)
            )
            if not row:
                raise LookupError("report_not_found")
            row["payload"] = json.loads(row["payload"]) if row["payload"] else None
            return row
        if dataset in {"detail", "model", "assumptions"}:
            store = self.market.store
            coverage = store.one("SELECT * FROM coverage WHERE symbol=?", (symbol,))
            if (context == "coverage" or dataset != "detail") and not coverage:
                raise LookupError("coverage_required")
            if dataset == "assumptions":
                return self.assumptions.read(symbol, scenario)
            if dataset == "model":
                base = await self.market.fundamentals(symbol)
                if base is None:
                    return unavailable_model(scenario)
                recommendation = self.assumptions.read(symbol)
                return {
                    **compute_model(base, store.assumptions(symbol), scenario, self.assumptions.overrides(symbol, scenario) if scenario != "base" else None),
                    "recommendation_state": recommendation["state"],
                }
            data = await compose(self.market, symbol, store.assumptions(symbol))
            reports = store.reports(symbol)
            latest = store.one(
                "SELECT payload FROM reports WHERE symbol=? AND status='completed' ORDER BY completed_at DESC LIMIT 1",
                (symbol,),
            )
            report = json.loads(latest["payload"]) if latest else None
            if context != "coverage":
                data.pop("model", None)
            return {
                **data,
                "coverage": coverage,
                "reports": reports,
                "summary": report["sections"][0]["content"] if report else None,
            }
        if dataset == "peers":
            return self.market.peers.read(symbol)
        if dataset == "market_metrics":
            from .dossier import basic_metrics

            return {"state": "ready", "data": await basic_metrics(self.market, symbol)}
        if dataset == "metrics":
            return await self.market.financial_data.get(symbol, fields)
        if dataset == "company":
            return self.intelligence.company(symbol)
        if dataset == "disclosures":
            return self.intelligence.disclosures(symbol)
        if dataset == "research":
            return self.intelligence.research(symbol)
        if dataset in {"sentiment", "catalysts"}:
            return await self.signals.read(symbol, dataset)
        if dataset not in {"quote", "prices"}:
            raise ValueError("unknown dataset")
        try:
            data = await (
                self.market.quote(symbol)
                if dataset == "quote"
                else self.market.price_history(symbol)
            )
            available = (
                data.get("price") is not None if dataset == "quote" else bool(data.get("points"))
            )
            return {
                "state": "ready" if available else "unavailable",
                "data": data if available else None,
                "updated_at": data.get("as_of"),
            }
        except ProviderError:
            return {"state": "unavailable", "data": None, "updated_at": None}
