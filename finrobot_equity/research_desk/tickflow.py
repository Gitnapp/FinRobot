"""TickFlow market adapter: canonical symbols, exchange dates and consistent daily prices."""

import asyncio
import json
import math
import os
import time
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from .providers import ProviderError


def wire_symbol(symbol):
    return symbol if symbol.endswith((".SH", ".SZ", ".BJ", ".HK", ".US")) else symbol + ".US"


def currency_for(symbol):
    return (
        "HKD"
        if symbol.endswith(".HK")
        else "CNY"
        if symbol.endswith((".SH", ".SZ", ".BJ"))
        else "USD"
    )


def decode_bars(data, symbol):
    zone = ZoneInfo("America/New_York" if currency_for(symbol) == "USD" else "Asia/Shanghai")
    keys = ["timestamp", "open", "high", "low", "close", "volume"]
    if not isinstance(data, dict) or any(not isinstance(data.get(k), list) for k in keys):
        raise ProviderError("invalid_daily_data")
    count = len(data["timestamp"])
    if any(len(data[k]) != count for k in keys):
        raise ProviderError("mismatched_daily_columns")
    points = []
    for i in range(count):
        bar = {k: float(data[k][i]) for k in keys}
        if (
            any(not math.isfinite(v) for v in bar.values())
            or min(bar[k] for k in ["open", "high", "low", "close"]) <= 0
            or bar["volume"] < 0
        ):
            raise ProviderError("invalid_daily_value")
        if bar["high"] < max(bar["open"], bar["close"]) or bar["low"] > min(
            bar["open"], bar["close"]
        ):
            raise ProviderError("invalid_daily_range")
        timestamp = bar.pop("timestamp")
        day = (
            datetime.fromtimestamp(timestamp / 1000, timezone.utc)
            .astimezone(zone)
            .date()
            .isoformat()
        )
        points.append({"time": day, **bar, "_timestamp": int(timestamp)})
    return sorted(points, key=lambda p: p["time"])


class TickFlowMarket:
    def __init__(self, store, providers):
        self.store = store
        self.providers = providers
        self.pending = {}

    async def cached(self, key, fetch, ttl):
        key = "tickflow:" + key
        row = self.store.one("SELECT value,expires FROM cache WHERE key=?", (key,))
        if row and row["expires"] > time.time():
            return json.loads(row["value"])

        async def run():
            value = await fetch()
            self.store.execute(
                "INSERT OR REPLACE INTO cache VALUES (?,?,?)",
                (key, json.dumps(value, allow_nan=False), time.time() + ttl),
            )
            return value

        if key not in self.pending:
            task = asyncio.create_task(run())
            self.pending[key] = task
            task.add_done_callback(lambda _: self.pending.pop(key, None))
        return await asyncio.shield(self.pending[key])

    async def instrument(self, symbol):
        async def fetch():
            rows = (
                await self.providers.get(
                    "TickFlow", "instruments", {"symbols": wire_symbol(symbol)}
                )
            )["data"]
            item = next((r for r in rows if r["symbol"] == wire_symbol(symbol)), None)
            if item is None:
                raise ProviderError("instrument_unavailable")
            return item

        try:
            return await self.cached("instrument:" + wire_symbol(symbol), fetch, 86400)
        except (KeyError, TypeError, ValueError, StopIteration):
            raise ProviderError("instrument_unavailable") from None

    async def history(self, symbol):
        async def fetch():
            all_points = {}
            end = None
            completed = False
            for _ in range(10):
                params = {
                    "symbol": wire_symbol(symbol),
                    "period": "1d",
                    "count": 10000,
                    "adjust": "forward",
                }
                if end is not None:
                    params["end_time"] = end
                raw = (await self.providers.get("TickFlow", "klines", params))["data"]
                points = decode_bars(raw, symbol)
                if not points:
                    completed = True
                    break
                if end is not None and points[0]["_timestamp"] > end:
                    raise ProviderError("invalid_history_pagination")
                all_points.update({p["time"]: p for p in points})
                if len(points) < 10000:
                    completed = True
                    break
                next_end = points[0]["_timestamp"] - 1
                if end is not None and next_end >= end:
                    raise ProviderError("history_pagination_stalled")
                end = next_end
            points = sorted(all_points.values(), key=lambda p: p["time"])
            if not points:
                raise ProviderError("history_unavailable")
            for p in points:
                p.pop("_timestamp")
            inst = await self.instrument(symbol)
            listing = inst.get("ext", {}).get("listing_date")
            full_listing = (
                completed
                and date.fromisoformat(points[0]["time"])
                <= date.fromisoformat(listing) + timedelta(days=7)
                if listing
                else None
            )
            return {
                "listing_date": listing,
                "points": points,
                "source": "TickFlow",
                "mock": False,
                "currency": currency_for(symbol),
                "as_of": points[-1]["time"],
                "start": points[0]["time"],
                "complete": full_listing,
                "note": f"供应商可用历史，比例前复权日线；{points[0]['time']} 至 {points[-1]['time']}，{len(points):,} 根。免费服务为历史收盘数据，盘中不实时更新。",
            }

        try:
            return await self.cached("history:forward:" + wire_symbol(symbol), fetch, 3600)
        except (KeyError, TypeError, ValueError):
            raise ProviderError("invalid_history") from None

    async def quote(self, symbol):
        instrument = await self.instrument(symbol)
        currency = currency_for(symbol)
        if os.getenv("TICKFLOW_API_KEY"):
            raw = (
                await self.providers.get("TickFlow", "quotes", {"symbols": wire_symbol(symbol)})
            )["data"]
            q = next((q for q in raw if q["symbol"] == wire_symbol(symbol)), None)
            if q is None:
                raise ProviderError("quote_unavailable")
            price = float(q["last_price"])
            previous = float(q["prev_close"])
            stamp = q.get("timestamp")
            as_of = (
                datetime.fromtimestamp(stamp / 1000, timezone.utc).isoformat() if stamp else None
            )
            note = "行情快照；以交易所交易时段为准。"
        else:
            history = await self.history(symbol)
            rows = history["points"]
            price = rows[-1]["close"]
            previous = rows[-2]["close"] if len(rows) > 1 else None
            as_of = history["as_of"]
            note = f"最近交易日收盘行情，截至 {as_of}；非实时价格。"
        if not math.isfinite(price) or price <= 0:
            raise ProviderError("invalid_quote")
        shares = instrument.get("ext", {}).get("total_shares")
        cap = (
            price * float(shares)
            if shares and math.isfinite(float(shares)) and float(shares) > 0
            else None
        )
        return {
            "price_kind": "realtime" if os.getenv("TICKFLOW_API_KEY") else "close",
            "symbol": symbol,
            "name": instrument["name"],
            "sector": instrument["exchange"],
            "price": price,
            "change_percent": (price / previous - 1) * 100 if previous else None,
            "market_cap": cap,
            "currency": currency,
            "source": "TickFlow",
            "mock": False,
            "as_of": as_of,
            "note": note,
        }

    async def search(self, query):
        async def exchange(name):
            async def fetch():
                return (
                    await self.providers.get(
                        "TickFlow", f"exchanges/{name}/instruments", {"type": "stock"}
                    )
                )["data"]

            return await self.cached("exchange:" + name, fetch, 86400)

        if query.upper().endswith((".US", ".SH", ".SZ", ".BJ", ".HK")):
            item = await self.instrument(query.upper())
            rows = [item]
        else:
            results = await asyncio.gather(
                *(exchange(e) for e in ["SH", "SZ", "BJ", "US", "HK"]), return_exceptions=True
            )
            rows = [r for result in results if isinstance(result, list) for r in result]
        needle = query.lower()
        return [
            {
                "symbol": r["symbol"][:-3] if r["symbol"].endswith(".US") else r["symbol"],
                "name": r["name"],
                "sector": r["exchange"],
            }
            for r in rows
            if needle in (r["name"] + " " + r["symbol"]).lower()
        ][:40]
