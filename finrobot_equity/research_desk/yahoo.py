"""Yahoo quote/history share one validated, cached series; no per-window downloads."""

import asyncio
import json
import sys
import time
from pathlib import Path

from .providers import ProviderError

YAHOO_MARKETS = {
    "KS": "KRW",
    "KQ": "KRW",
    "T": "JPY",
    "AS": "EUR",
    "PA": "EUR",
}


def yahoo_symbol(symbol):
    if symbol.endswith(".SH"):
        return symbol[:-3] + ".SS"
    if symbol.endswith(".HK") and symbol[:-3].isdigit():
        return str(int(symbol[:-3])).zfill(4) + ".HK"
    return symbol.removesuffix(".US")


class YahooMarket:
    def __init__(self, store):
        self.store = store
        self.pending = {}
        self.gate = asyncio.Semaphore(2)
        self.dataset_gate = asyncio.Semaphore(2)

    async def snapshot(self, symbol):
        key = "yahoo:daily:" + symbol
        row = self.store.one("SELECT value,expires FROM cache WHERE key=?", (key,))
        if row and row["expires"] > time.time():
            return json.loads(row["value"])

        async def fetch():
            blocked = self.store.one("SELECT expires FROM cache WHERE key=?", (key + ":retry",))
            if blocked and blocked["expires"] > time.time():
                if row and row["expires"] > time.time() - 2 * 86400:
                    return {**json.loads(row["value"]), "stale": True}
                raise ProviderError("yahoo_unavailable")
            process = None
            try:
                async with asyncio.timeout(35):
                    async with self.gate:
                        process = await asyncio.create_subprocess_exec(
                            sys.executable,
                            str(Path(__file__).with_name("yahoo_worker.py")),
                            yahoo_symbol(symbol),
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.PIPE,
                        )
                        output, _ = await process.communicate()
                if process.returncode:
                    raise ValueError("yahoo_unavailable")
                data = json.loads(output)
                if not data.get("points"):
                    raise ValueError("empty_history")
                self.store.execute(
                    "INSERT OR REPLACE INTO cache VALUES (?,?,?)",
                    (key, json.dumps(data), time.time() + 300),
                )
                return data
            except (ValueError, TimeoutError):
                self.store.execute(
                    "INSERT OR REPLACE INTO cache VALUES (?,?,?)",
                    (key + ":retry", "null", time.time() + 900),
                )
                if row and row["expires"] > time.time() - 2 * 86400:
                    return {**json.loads(row["value"]), "stale": True}
                raise ProviderError("yahoo_unavailable") from None
            finally:
                if process and process.returncode is None:
                    process.kill()
                    await process.wait()

        if key not in self.pending:
            task = asyncio.create_task(fetch())
            self.pending[key] = task
            task.add_done_callback(lambda _: self.pending.pop(key, None))
        return await asyncio.shield(self.pending[key])

    async def history(self, symbol):
        data = await self.snapshot(symbol)
        points = data["points"]
        return {
            "points": points,
            "source": "Yahoo Finance",
            "mock": False,
            "currency": data["currency"],
            "as_of": points[-1]["time"],
            "start": points[0]["time"],
            "complete": None,
            "note": "Yahoo Finance 可用日线；股息与拆股调整。各时间范围共用同一序列。"
            + ("当前为最近一次有效数据。" if data.get("stale") else ""),
        }

    async def quote(self, symbol):
        data = await self.snapshot(symbol)
        points = data["points"]
        last, previous = points[-1], points[-2] if len(points) > 1 else None
        try:
            statistics = await self.statistics(symbol)
        except (ProviderError, ValueError, TimeoutError):
            statistics = {}
        return {
            "symbol": symbol,
            "name": data["name"],
            "sector": data.get("exchange") or "",
            "currency": data["currency"],
            "price": last["close"],
            "change_percent": (last["close"] / previous["close"] - 1) * 100 if previous else None,
            "market_cap": statistics.get("marketCap"),
            "market_cap_timestamp": statistics.get("regularMarketTime"),
            "source": "Yahoo Finance",
            "mock": False,
            "price_kind": "close",
            "as_of": last["time"],
            "note": "Yahoo Finance 最近交易日收盘行情；非实时价格。"
            + ("当前为最近一次有效数据。" if data.get("stale") else ""),
        }

    async def instrument(self, symbol):
        data = await self.snapshot(symbol)
        return {
            "symbol": symbol,
            "name": data["name"],
            "exchange": data.get("exchange"),
            "currency": data["currency"],
        }

    async def _dataset(self, symbol, kind):
        async with self.dataset_gate:
            process = await asyncio.create_subprocess_exec(
                sys.executable,
                str(Path(__file__).with_name("yahoo_worker.py")),
                yahoo_symbol(symbol),
                kind,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout, _ = await asyncio.wait_for(process.communicate(), 23)
                if process.returncode:
                    raise ProviderError("yahoo_financials_unavailable")
                return json.loads(stdout)
            finally:
                if process.returncode is None:
                    process.kill()
                    await process.wait()

    async def statistics(self, symbol):
        key = "yahoo:statistics:" + symbol
        row = self.store.one("SELECT value,expires FROM cache WHERE key=?", (key,))
        if row and row["expires"] > time.time():
            return json.loads(row["value"])

        async def load():
            try:
                result = await self._dataset(symbol, "statistics")
                ttl = 3600
            except (ProviderError, ValueError, TimeoutError):
                result = json.loads(row["value"]) if row else {}
                ttl = 900
            self.store.execute(
                "INSERT OR REPLACE INTO cache VALUES (?,?,?)",
                (key, json.dumps(result), time.time() + ttl),
            )
            return result

        if key not in self.pending:
            task = asyncio.create_task(load())
            self.pending[key] = task
            task.add_done_callback(lambda _: self.pending.pop(key, None))
        return await asyncio.shield(self.pending[key])

    async def financials(self, symbol):
        return await self._dataset(symbol, "financials")

    async def earnings(self, symbol):
        return await self._dataset(symbol, "earnings")

    async def close(self):
        tasks = list(self.pending.values())
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
