"""Coverage quotes are independent of financial-research enrollment."""

from .providers import ProviderError


class CoverageMarket:
    def __init__(self, store, market, snapshots):
        self.store = store
        self.market = market
        self.snapshots = snapshots

    def read(self, companies):
        results = {}
        for symbol in sorted({r["symbol"] for r in companies if r.get("symbol")}):
            snapshot = self.snapshots.read(
                "coverage-market:" + symbol, lambda s=symbol: self.collect(s), 3600, 2 * 86400
            )
            financial = self.market.financial_data.read(symbol)
            if snapshot["data"]:
                data = {**snapshot["data"], "financials": None}
                report = financial["data"]
                if report:
                    fields = report["fields"]
                    data["financials"] = {
                        "revenue": fields["revenue"]["value"] / 1e6
                        if fields["revenue"]["value"] is not None
                        else None,
                        "ebitda": fields["ebitda"]["value"] / 1e6
                        if fields["ebitda"]["value"] is not None
                        else None,
                        "gross_margin": fields["gross_margin"]["value"],
                        "as_of": report["period"],
                        "currency": report["currency"],
                    }
                snapshot = {
                    **snapshot,
                    "data": data,
                    "refreshing": snapshot["refreshing"] or financial["refreshing"],
                }
            results[symbol] = snapshot
        return results

    async def collect(self, symbol):
        quote = await self.market.quote(symbol)
        if quote["price"] is None:
            raise ProviderError("quote_unavailable")
        history = await self.market.history(symbol)
        points = history["points"]
        if not points:
            raise ProviderError("history_unavailable")
        stride = max(1, len(points) // 60)
        sample = points[::stride]
        if sample[-1]["time"] != points[-1]["time"]:
            sample.append(points[-1])
        financials = None
        return {
            "quote": quote,
            "history": {**history, "points": sample},
            "financials": financials,
            "range": {
                "change": (points[-1]["close"] / points[0]["close"] - 1) * 100,
                "high": max(p["high"] for p in points),
                "low": min(p["low"] for p in points),
                "start": points[0]["time"],
                "end": points[-1]["time"],
            },
        }
