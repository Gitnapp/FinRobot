"""Application data interface. Domain modules own provider selection and normalization."""

from .providers import ProviderError
from .schemas import SymbolInput


class DataAccess:
    def __init__(self, market, intelligence, signals):
        self.market, self.intelligence, self.signals = market, intelligence, signals

    async def read(self, subject, dataset, *, fields=None, start=None, end=None):
        if dataset in {"macro", "calendar"}:
            if dataset == "macro":
                return self.intelligence.macro()
            return self.intelligence.calendar(start, end)
        if dataset == "research" and self.market.store.one(
            "SELECT id FROM coverage_companies WHERE id=?", (subject,)
        ):
            return self.intelligence.research(subject)
        symbol = SymbolInput(symbol=subject).symbol
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
