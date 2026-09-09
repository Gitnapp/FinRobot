"""Small domain interface. Provider mechanics never become frontend dependencies."""

from .cache import SnapshotCache
from .sources import Sources
from .transport import SourceTransport


class Intelligence:
    FRED = [
        ("us_policy_rate", "FEDFUNDS", "美国政策利率", "%"),
        ("us_treasury_10y", "DGS10", "美国10年国债收益率", "%"),
        ("us_yield_curve", "T10Y2Y", "美债10年−2年利差", "百分点"),
        ("us_unemployment", "UNRATE", "美国失业率", "%"),
    ]

    def __init__(self, store, financial_data=None, sources=None):
        self.store = store
        self.cache = financial_data.cache if financial_data else SnapshotCache(store)
        self.financial_data = financial_data
        self.sources = sources or Sources(SourceTransport())

    def macro(self):
        values = {
            metric: self.cache.read(
                "fred:" + code,
                lambda c=code, label_text=label, u=unit: self.sources.fred(c, label_text, u),
            )
            for metric, code, label, unit in self.FRED
        }
        values["cn_manufacturing_pmi"] = self.cache.read(
            "akshare:pmi", lambda: self.sources.akshare("pmi"), 86400
        )
        values["cn_cpi"] = self.cache.read(
            "akshare:cpi", lambda: self.sources.akshare("cpi"), 86400
        )
        return values

    def calendar(self, start=None, end=None):
        from datetime import date, timedelta

        if start or end:
            lower = date.fromisoformat(start) if start else date.today() - timedelta(days=365)
            upper = date.fromisoformat(end) if end else date.today()
            if lower > upper or (upper - lower).days > 366:
                raise ValueError("calendar range must be within one year")
            monday = date.today() - timedelta(days=date.today().weekday())
            if not (monday <= lower <= upper <= monday + timedelta(days=6)):
                return self.cache.read(
                    f"calendar:macro:{lower}:{upper}",
                    lambda: self.sources.calendar(lower.isoformat(), upper.isoformat()),
                    86400,
                    30 * 86400,
                )
        return self.cache.read("calendar:macro", self.sources.calendar, 86400, 2 * 86400)

    def company(self, symbol):
        from ..financial_data.views import evidence_view

        if not self.financial_data:
            from ..financial_data import FinancialData
            from ..financial_data.providers import SecReports, ChinaReports

            self.financial_data = FinancialData(
                self.store,
                self.cache,
                {"sec": SecReports(self.sources), "china": ChinaReports(self.sources)},
            )
        snapshot = self.financial_data.read(symbol)
        return {**snapshot, "data": evidence_view(snapshot["data"]) if snapshot["data"] else None}

    def research(self, symbol):
        import json

        companies = [
            json.loads(r["payload"])
            for r in self.store.all("SELECT payload FROM coverage_companies")
        ]
        company = next(
            (r["name"] for r in companies if r.get("symbol") == symbol or r["id"] == symbol), symbol
        )
        return self.cache.read(
            "research:" + symbol, lambda: self.sources.research(company), 7 * 86400, 30 * 86400
        )

    def disclosures(self, symbol):
        if symbol.endswith((".SH", ".SZ", ".BJ")):
            return self.cache.read(
                "cn-disclosures:" + symbol,
                lambda: self.sources.china(symbol, "filings"),
                86400,
                30 * 86400,
            )
        if symbol.endswith((".HK", ".KS", ".KQ", ".T", ".AS", ".PA")):
            return {"state": "unavailable", "data": None, "updated_at": None}
        return self.cache.read(
            "disclosures:" + symbol, lambda: self.sources.disclosures(symbol), 86400, 30 * 86400
        )
