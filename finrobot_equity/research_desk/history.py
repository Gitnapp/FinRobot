"""Listing-to-present daily bars, fetched in bounded windows and persisted locally."""

import asyncio
import json
import math
import time
from datetime import date, datetime, timedelta, timezone

from .providers import ProviderError


class HistoryArchive:
    def __init__(self, store, providers):
        self.store = store
        self.providers = providers
        self.pending = {}

    async def read(self, symbol):
        if symbol not in self.pending:
            task = asyncio.create_task(self.collect(symbol))
            self.pending[symbol] = task
            task.add_done_callback(lambda _: self.pending.pop(symbol, None))
        return await asyncio.shield(self.pending[symbol])

    async def cached(self, key, fetch, ttl):
        row = self.store.one("SELECT value,expires FROM cache WHERE key=?", (key,))
        if row and row["expires"] > time.time():
            return json.loads(row["value"])
        result = await fetch()
        self.store.execute(
            "INSERT OR REPLACE INTO cache VALUES (?,?,?)",
            (key, json.dumps(result, allow_nan=False), time.time() + ttl),
        )
        return result

    async def collect(self, symbol):
        if self.store.settings()["data_mode"] == "mock":
            raise ProviderError("demo_mode")

        async def profile():
            raw = await self.providers.get("FMP", "profile", {"symbol": symbol})
            return date.fromisoformat(raw[0]["ipoDate"]).isoformat()

        try:
            ipo = date.fromisoformat(await self.cached(f"listing:{symbol}", profile, 86400 * 30))
            today = datetime.now(timezone.utc).date()
            if ipo > today or ipo.year < 1800:
                raise ValueError("invalid listing date")
            windows = []
            cursor = ipo
            while cursor <= today:
                end = min(cursor + timedelta(days=1460), today)
                windows.append((cursor, end))
                cursor = end + timedelta(days=1)
            # Limit the number of waiting provider requests, not just HTTP connections.
            gate = asyncio.Semaphore(2)

            async def window(start, end):
                async def fetch():
                    async with gate:
                        raw = await self.providers.get(
                            "FMP",
                            "historical-price-eod/full",
                            {"symbol": symbol, "from": start.isoformat(), "to": end.isoformat()},
                        )
                    if not isinstance(raw, list):
                        raise ProviderError("missing_history_window")
                    points = []
                    for row in raw:
                        day = date.fromisoformat(row["date"])
                        if not start <= day <= end:
                            raise ValueError("provider ignored date bounds")
                        bar = {k: float(row[k]) for k in ("open", "high", "low", "close")}
                        if any(not math.isfinite(v) or v <= 0 for v in bar.values()):
                            raise ValueError("invalid price")
                        if bar["low"] > min(bar["open"], bar["close"]) or bar["high"] < max(
                            bar["open"], bar["close"]
                        ):
                            raise ValueError("invalid OHLC")
                        volume = float(row.get("volume") or 0)
                        if not math.isfinite(volume) or volume < 0:
                            raise ValueError("invalid volume")
                        points.append({"time": day.isoformat(), **bar, "volume": volume})
                    return points

                # Past prices may be restated for splits: refresh closed windows weekly.
                return await self.cached(
                    f"daily-archive:{symbol}:{start}:{end}",
                    fetch,
                    21600 if end == today else 7 * 86400,
                )

            groups = await asyncio.gather(*(window(a, b) for a, b in windows))
            points = sorted(
                {p["time"]: p for group in groups for p in group}.values(), key=lambda p: p["time"]
            )
            if not points:
                raise ProviderError("missing_history")
            complete = all(
                group
                and min(p["time"] for p in group) <= (start + timedelta(days=7)).isoformat()
                and max(p["time"] for p in group) >= (end - timedelta(days=7)).isoformat()
                for (start, end), group in zip(windows, groups)
            )
            return {
                "points": points,
                "source": "FMP",
                "mock": False,
                "as_of": points[-1]["time"],
                "listing_date": ipo.isoformat(),
                "complete": complete,
                "start": points[0]["time"],
                "note": f"{'已覆盖上市以来历史' if complete else '供应商历史覆盖不完整'}。上市日期 {ipo}；已获取 {len(points):,} 根日线，含开高低收和成交量。FMP历史价格口径，非逐笔成交。",
            }
        except (KeyError, TypeError, ValueError, IndexError):
            raise ProviderError("invalid_history") from None
