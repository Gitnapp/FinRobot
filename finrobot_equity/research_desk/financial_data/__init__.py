"""Small financial interface: annual metrics with provenance, independent of vendors."""

import asyncio
import copy
import logging
import time
from datetime import date

from ..cache_policy import FINANCIAL_MAX_STALE, tracking_ttl
from .normalize import derive
from .registry import METRICS


class FinancialData:
    def __init__(self, store, cache, providers):
        self.store, self.cache, self.providers = store, cache, providers
        self.last_tick = None

    def read(self, symbol):
        coverage = self.store.one("SELECT cadence FROM coverage WHERE symbol=?", (symbol,))
        ttl = tracking_ttl(coverage["cadence"] if coverage else None)
        # Shortening the tracking cadence takes effect on existing snapshots too.
        if not self.cache.initialized:
            self.cache.init()
        return self.cache.read(
            "financial-metrics:" + symbol, lambda: self.collect(symbol), ttl, FINANCIAL_MAX_STALE
        )

    async def run(self):
        """Refresh tracked financials independently of page views and report generation.

        Persisted snapshot expiry and retry_after are the schedule. Cache.read coalesces
        foreground/background requests and bounds concurrency; no second job queue.
        """
        while True:
            try:
                for row in self.store.all(
                    "SELECT symbol FROM coverage WHERE active=1 ORDER BY symbol"
                ):
                    self.read(row["symbol"])
                self.last_tick = time.time()
            except Exception:
                logging.getLogger(__name__).exception("Financial refresh scan failed")
            await asyncio.sleep(60)

    async def get(self, symbol, fields=None):
        if fields is not None and set(fields) - METRICS.keys():
            raise ValueError("Unknown metric")
        snapshot = self.read(symbol)
        if snapshot["data"] is None and snapshot.get("refreshing"):
            await asyncio.shield(self.cache.tasks["financial-metrics:" + symbol])
            snapshot = self.read(symbol)
        report = copy.deepcopy(snapshot["data"])
        if report:
            report = derive(report)
        if report and fields is not None:
            report["fields"] = {k: report["fields"][k] for k in fields}
        return {**snapshot, "data": report}

    async def collect(self, symbol):
        reports = []
        errors = []
        started = time.monotonic()
        foreign = symbol.endswith((".HK", ".KS", ".KQ", ".T", ".AS", ".PA"))
        order = (
            ["china", "yahoo"]
            if symbol.endswith((".SH", ".SZ", ".BJ"))
            else ["yahoo"]
            if foreign
            else ["sec", "finnhub", "yahoo", "fmp"]
        )
        for name in order:
            provider = self.providers.get(name)
            if not provider:
                continue
            remaining = 32 - (time.monotonic() - started)
            if remaining < 1:
                break
            try:
                async with asyncio.timeout(min(20, remaining)):
                    candidates = await provider.load(symbol)
            except Exception:
                errors.append(name)
                continue
            reports.extend(candidates)
            if reports:
                # Prefer the first trustworthy source's latest period; only supplement exact matches.
                anchor = max(
                    reports[: len(reports) - len(candidates)] or candidates,
                    key=lambda r: r["period"],
                )
                merged = self.resolve(reports, anchor)
                essential = (
                    "revenue",
                    "cost_of_revenue",
                    "operating_income",
                    "net_income",
                    "operating_cash_flow",
                    "depreciation_amortization",
                    "capex",
                    "cash",
                    "total_debt",
                    "diluted_shares",
                    "income_tax",
                    "interest_expense",
                    "pretax_income",
                )
                if all(merged["fields"][k]["value"] is not None for k in essential):
                    break
        if not reports:
            raise ValueError("financial_sources_unavailable")
        # Report order preserves provider priority even if a lower-priority provider has newer data.
        primary_provider = next(
            (
                r["fields"].get("revenue", {}).get("provider")
                for r in reports
                if "revenue" in r["fields"]
            ),
            None,
        )
        primary = [
            r for r in reports if r["fields"].get("revenue", {}).get("provider") == primary_provider
        ]
        anchor = max(primary or reports, key=lambda r: r["period"])
        result = self.resolve(reports, anchor)
        result.update(symbol=symbol, source_errors=errors)
        return result

    @staticmethod
    def resolve(reports, anchor):
        result = copy.deepcopy(anchor)

        def merge_for(target):
            values = {}
            for report in reports:
                if report["period"] != target["period"] or report["currency"] != target["currency"]:
                    continue
                if (
                    report.get("start")
                    and target.get("start")
                    and report["start"] != target["start"]
                ):
                    continue
                for key, field in report["fields"].items():
                    if field.get("value") is not None and key not in values:
                        values[key] = copy.deepcopy(field)
            return {**target, "fields": values}

        result = merge_for(result)
        previous = next(
            (
                r
                for r in sorted(reports, key=lambda r: r["period"], reverse=True)
                if r["currency"] == result["currency"]
                and 330
                <= (date.fromisoformat(result["period"]) - date.fromisoformat(r["period"])).days
                <= 400
            ),
            None,
        )
        return derive(result, merge_for(previous) if previous else None)

    async def model_base(self, symbol):
        report = (await self.get(symbol))["data"]
        if not report:
            return None
        values = {k: v["value"] for k, v in report["fields"].items()}
        if values["revenue"] is None or values["revenue"] <= 0:
            return None
        mapping = {
            "revenue": "revenue",
            "cogs": "cost_of_revenue",
            "opex": "operating_expenses_ex_da",
            "da": "depreciation_amortization",
            "interest": "interest_expense",
            "tax": "income_tax",
            "capex": "capex",
            "nwc": "working_capital_change",
            "shares": "diluted_shares",
            "net_debt": "net_debt",
            "net_income": "net_income",
            "pretax": "pretax_income",
            "operating_income": "operating_income",
            "operating_cash_flow": "operating_cash_flow",
            "fcf": "free_cash_flow",
        }
        base = {
            key: values[field] / 1e6 if values[field] is not None else None
            for key, field in mapping.items()
        }
        sources = sorted(
            {f["provider"] for f in report["fields"].values() if f.get("status") == "reported"}
        )
        return {
            **base,
            "year": report["year"],
            "currency": report["currency"],
            "growth": values["revenue_growth"],
            "mock": False,
            "as_of": report["period"],
            "source": " / ".join(sources),
            "metric_sources": report["fields"],
        }
