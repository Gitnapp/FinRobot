"""Normalized tracking signals; independent cache, bounded latency, no invented facts."""

import asyncio
import json
import math
import time
from datetime import datetime, timedelta, timezone

from .providers import ProviderError


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
    def __init__(self, store, providers):
        self.store = store
        self.providers = providers
        self.pending = {}

    async def read(self, symbol, kind):
        mode = self.store.settings()["data_mode"]
        key = f"signals:{mode}:{symbol}:{kind}"
        row = self.store.one("SELECT value,expires FROM cache WHERE key=?", (key,))
        if row and row["expires"] > time.time():
            return json.loads(row["value"])
        if key not in self.pending:
            task = asyncio.create_task(self.refresh(key, row, symbol, kind, mode))
            self.pending[key] = task
            task.add_done_callback(lambda _: self.pending.pop(key, None))
        return await asyncio.shield(self.pending[key])

    async def refresh(self, key, cached, symbol, kind, mode):
        stamp = datetime.now(timezone.utc).isoformat()
        result = {"status": "ready", "as_of": stamp, "data": None, "reason": None}
        ttl = 21600  # Four reads per symbol/day at most; protects free sentiment quotas.
        try:
            if mode == "mock":
                result.update(status="unavailable", reason="demo_mode")
            else:
                async with asyncio.timeout(12):
                    result["data"] = await getattr(self, kind)(symbol)
                if result["data"] is None:
                    result.update(status="empty")
        except (ProviderError, TimeoutError, ValueError, TypeError, KeyError, IndexError):
            result.update(status="unavailable", reason="temporarily_unavailable")
            if cached:
                old = json.loads(cached["value"])
                age = (
                    datetime.now(timezone.utc) - datetime.fromisoformat(old["as_of"])
                ).total_seconds()
                if old.get("data") is not None and age < 7 * 86400:
                    result = {**old, "status": "stale", "reason": "temporarily_unavailable"}
            ttl = 900
        self.store.execute(
            "INSERT OR REPLACE INTO cache VALUES (?,?,?)",
            (key, json.dumps(result, allow_nan=False), time.time() + ttl),
        )
        return result

    async def catalysts(self, symbol):
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

    async def sentiment(self, symbol):
        today = datetime.now(timezone.utc).date()
        start = today - timedelta(days=6)
        raw = await self.providers.get(
            "Adanos",
            f"reddit/stocks/v1/stock/{symbol}",
            {"from": start.isoformat(), "to": today.isoformat()},
        )
        if not isinstance(raw, dict):
            raise ValueError("invalid sentiment")
        if raw.get("found") is False:
            return None
        if raw.get("ticker", "").upper() != symbol:
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
