"""Normalized tracking signals; independent cache, bounded latency, no invented facts."""

import asyncio
import json
import math
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from .cache_policy import SIGNALS, UPSTREAM_RETRY_SECONDS
from .providers import ProviderError
from .yahoo import yahoo_symbol


def number(value, low=None, high=None):
    if value is None:
        return None
    result = float(value)
    if (
        not math.isfinite(result)
        or (low is not None and result < low)
        or (high is not None and result > high)
    ):
        raise ValueError("invalid metric")
    return result


class TrackingSignals:
    def __init__(self, store, providers, yahoo=None):
        self.store = store
        self.providers = providers
        self.yahoo = yahoo
        self.pending = {}

    async def read(self, symbol, kind):
        mode = self.store.settings()["data_mode"]
        key = f"signals:{mode}:{symbol}:{kind}"
        row = self.store.one("SELECT value,expires FROM cache WHERE key=?", (key,))
        if row and row["expires"] > time.time():
            return self.links(symbol, kind, json.loads(row["value"]))
        if key not in self.pending:
            task = asyncio.create_task(self.refresh(key, row, symbol, kind, mode))
            self.pending[key] = task
            task.add_done_callback(lambda _: self.pending.pop(key, None))
        return self.links(symbol, kind, await asyncio.shield(self.pending[key]))

    @staticmethod
    def links(symbol, kind, result):
        if kind == "catalysts" and result.get("data"):
            for event in result["data"].get("events", []):
                if not event.get("url"):
                    event["url"] = "https://finance.yahoo.com/calendar/earnings?" + urlencode(
                        {"symbol": yahoo_symbol(symbol), "day": event["date"]}
                    )
                    event["link_kind"] = "calendar_source"
        return result

    async def refresh(self, key, cached, symbol, kind, mode):
        stamp = datetime.now(timezone.utc).isoformat()
        result = {"status": "ready", "as_of": stamp, "data": None, "reason": None}
        ttl = SIGNALS.ttl  # Four reads per symbol/day at most; protects free sentiment quotas.
        try:
            async with asyncio.timeout(12):
                result["data"] = await getattr(self, kind)(symbol)
            if result["data"] is None:
                result.update(status="empty")
        except (ProviderError, TimeoutError, ValueError, TypeError, KeyError, IndexError) as exc:
            result.update(
                status="unavailable",
                reason="asset_not_supported"
                if isinstance(exc, ProviderError) and str(exc) == "not_found"
                else "temporarily_unavailable",
            )
            if cached:
                old = json.loads(cached["value"])
                age = (
                    datetime.now(timezone.utc) - datetime.fromisoformat(old["as_of"])
                ).total_seconds()
                if old.get("data") is not None and age < SIGNALS.max_stale:
                    result = {**old, "status": "stale", "reason": "temporarily_unavailable"}
            ttl = UPSTREAM_RETRY_SECONDS
        self.store.execute(
            "INSERT OR REPLACE INTO cache VALUES (?,?,?)",
            (key, json.dumps(result, allow_nan=False), time.time() + ttl),
        )
        return result

    async def catalysts(self, symbol):
        if not symbol.endswith((".SH", ".SZ", ".BJ", ".HK", ".KS", ".KQ", ".T", ".AS", ".PA")):
            try:
                result = await self._finnhub_catalysts(symbol)
                if result["events"] or not self.yahoo:
                    return result
            except (ProviderError, ValueError):
                if not self.yahoo:
                    raise
        if not self.yahoo:
            return {"events": [], "source": ""}
        raw = await self.yahoo.earnings(symbol)
        today = datetime.now(timezone.utc).date()
        return {
            "source": "Yahoo Finance",
            "events": [
                {
                    **row,
                    "title": "财报",
                    "timing": "日期以公司公告为准",
                    "upcoming": row["date"] >= today.isoformat(),
                    "revenue_estimate": None,
                }
                for row in raw["events"]
                if (today - timedelta(days=365)).isoformat()
                <= row["date"]
                <= (today + timedelta(days=180)).isoformat()
            ],
        }

    async def _finnhub_catalysts(self, symbol):
        today = datetime.now(timezone.utc).date()
        raw = await self.providers.get(
            "Finnhub",
            "calendar/earnings",
            {
                "symbol": symbol,
                "from": (today - timedelta(days=30)).isoformat(),
                "to": (today + timedelta(days=90)).isoformat(),
            },
        )
        if not isinstance(raw, dict) or not isinstance(raw.get("earningsCalendar"), list):
            raise ValueError("invalid calendar")
        events = {}
        for row in raw["earningsCalendar"]:
            if not isinstance(row, dict):
                raise ValueError("invalid event")
            if row.get("symbol") != symbol:
                continue
            day = datetime.strptime(row["date"], "%Y-%m-%d").date()
            if not today - timedelta(days=30) <= day <= today + timedelta(days=90):
                continue
            events[row["date"]] = {
                "date": row["date"],
                "title": f"{row.get('year', day.year)} Q{row.get('quarter', '')} 财报",
                "timing": {"bmo": "盘前", "amc": "盘后", "dmh": "盘中"}.get(
                    row.get("hour"), "时间待定"
                ),
                "upcoming": day >= today,
                "eps_estimate": number(row.get("epsEstimate")),
                "eps_actual": number(row.get("epsActual")),
                "revenue_estimate": number(row.get("revenueEstimate"), 0),
            }
        return {"events": sorted(events.values(), key=lambda x: x["date"]), "source": "Finnhub"}

    async def sentiment_ticker(self, symbol):
        exchanges = {
            "SH": {"SSE", "SHSE", "SHH"},
            "SZ": {"SZSE", "SHZ"},
            "BJ": {"BSE"},
            "HK": {"HKEX", "HKG"},
            "KS": {"KRX", "KOSPI"},
            "KQ": {"KRX", "KOSDAQ"},
            "T": {"TSE", "JPX", "TYO"},
            "AS": {"AMS", "EURONEXT AMSTERDAM"},
            "PA": {"PAR", "EURONEXT PARIS"},
        }
        base, _, suffix = symbol.rpartition(".")
        if suffix not in exchanges:
            return symbol.removesuffix(".US")
        key = "sentiment-identity:" + symbol
        cached = self.store.one("SELECT value,expires FROM cache WHERE key=?", (key,))
        if cached and cached["expires"] > time.time():
            return json.loads(cached["value"])
        raw = await self.providers.get(
            "Adanos", "reddit/stocks/v1/search", {"q": base, "limit": 20}
        )

        def same_code(code):
            code = code.upper().split(".")[0]
            return int(code) == int(base) if code.isdigit() and base.isdigit() else code == base

        matches = [
            r
            for r in raw.get("results", [])
            if (
                r.get("ticker", "").upper() == symbol
                or (
                    same_code(r.get("ticker", ""))
                    and (
                        str(r.get("exchange", "")).upper() in exchanges[suffix]
                        or (
                            str(r.get("exchange", "")).upper() == "EURONEXT"
                            and r.get("country")
                            == {"AS": "Netherlands", "PA": "France"}.get(suffix)
                        )
                    )
                )
            )
        ]
        if len(matches) != 1:
            raise ProviderError("not_found")
        ticker = matches[0]["ticker"].upper()
        self.store.execute(
            "INSERT OR REPLACE INTO cache VALUES (?,?,?)",
            (key, json.dumps(ticker), time.time() + 7 * 86400),
        )
        return ticker

    async def sentiment(self, symbol):
        ticker = await self.sentiment_ticker(symbol)
        today = datetime.now(timezone.utc).date()
        start = today - timedelta(days=6)
        raw = await self.providers.get(
            "Adanos",
            f"reddit/stocks/v1/stock/{ticker}",
            {"from": start.isoformat(), "to": today.isoformat()},
        )
        if not isinstance(raw, dict):
            raise ValueError("invalid sentiment")
        if raw.get("found") is False:
            return None
        if raw.get("ticker", "").upper() != ticker:
            raise ValueError("ticker mismatch")
        daily = {}
        for row in raw.get("daily_trend") or []:
            if not isinstance(row, dict):
                raise ValueError("invalid daily observation")
            day = datetime.strptime(row["date"], "%Y-%m-%d").date()
            if start <= day <= today:
                daily[row["date"]] = {
                    "date": row["date"],
                    "mentions": number(row.get("mentions"), 0),
                    "score": number(row.get("sentiment_score"), -1, 1),
                }
        return {
            "from": start.isoformat(),
            "to": today.isoformat(),
            "source": "Adanos / Reddit",
            "score": number(raw.get("sentiment_score"), -1, 1),
            "buzz": number(raw.get("buzz_score"), 0, 100),
            "mentions": number(raw.get("mentions"), 0),
            "bullish": number(raw.get("bullish_pct"), 0, 100),
            "bearish": number(raw.get("bearish_pct"), 0, 100),
            "trend": raw.get("trend")
            if raw.get("trend") in ["rising", "falling", "stable"]
            else None,
            "daily": sorted(daily.values(), key=lambda x: x["date"]),
        }
