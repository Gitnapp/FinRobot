"""Comparable-company discovery, durable selection and independently refreshed rows."""

import asyncio
import json
import logging
import math
import re
import time

from .cache_policy import PEER_DISCOVERY, PEER_QUOTE
from .intelligence.cache import SnapshotCache
from .schemas import SymbolInput


def canonical(symbol):
    symbol = symbol.upper()
    if symbol.endswith(".SS"):
        symbol = symbol[:-3] + ".SH"
    if symbol.endswith(".HK") and symbol[:-3].isdigit():
        symbol = symbol[:-3].zfill(5) + ".HK"
    return SymbolInput(symbol=symbol).symbol


def choose(subject, profile, candidates, suggested, rates):
    """Exact-industry equity candidates ranked by comparable USD size.

    FX is used only for selection, never to relabel displayed native prices.
    Unknown-size listings (including many warrants) cannot become automatic peers.
    """
    own_rate = rates.get(profile["currency"])
    own_cap = (profile.get("market_cap") or 0) * (own_rate or 0)
    valid = []
    for item in candidates:
        try:
            symbol = canonical(item["symbol"])
        except ValueError:
            continue
        currency = item.get("currency")
        cap = item.get("marketCap") or 0
        name = item.get("longName") or item.get("shortName")
        if (
            symbol == subject
            or item.get("quoteType") != "EQUITY"
            or not name
            or cap <= 0
            or not rates.get(currency)
            or item.get("exchange")
            not in {
                "NMS",
                "NYQ",
                "NGM",
                "NCM",
                "ASE",
                "HKG",
                "SHH",
                "SHZ",
                "KSC",
                "KOE",
                "JPX",
                "AMS",
                "PAR",
                "BATS",
            }
        ):
            continue
        if "." in symbol and not symbol.endswith(
            (".SH", ".SZ", ".BJ", ".HK", ".KS", ".KQ", ".T", ".AS", ".PA")
        ):
            continue
        if any(
            word in (item.get("shortName") or "").casefold()
            for word in ("warrant", "preferred", "rights", "(1p)", "(2p)")
        ):
            continue
        usd_cap = cap * rates[currency]
        distance = abs(math.log(usd_cap / own_cap)) if own_cap > 0 else -usd_cap
        valid.append(
            (symbol not in suggested, distance, symbol, {**item, "symbol": symbol, "name": name})
        )
    seen = {re.sub(r"\W", "", profile["name"]).casefold()}
    picked = []
    for _, _, _, item in sorted(valid, key=lambda r: r[:3]):
        issuer = re.sub(r"\W", "", item["name"]).casefold()
        if issuer in seen:
            continue
        seen.add(issuer)
        picked.append(
            {
                "symbol": item["symbol"],
                "name": item["name"],
                "currency": item["currency"],
                "industry": profile["industry"],
                "reason": "同属 "
                + profile["industry"]
                + "，按可比市值筛选"
                + ("；同时来自供应商同业候选" if item["symbol"] in suggested else ""),
                "source": "Yahoo Finance industry screen / FX"
                + (" / Finnhub" if item["symbol"] in suggested else ""),
            }
        )
        if len(picked) == 4:
            break
    return picked


class Peers:
    def __init__(self, store, market):
        self.store, self.market = store, market
        self.cache = SnapshotCache(store)
        self.cache.gate = asyncio.Semaphore(2)
        self.last_tick = None

    async def reference(self, key, loader, ttl=PEER_DISCOVERY.ttl):
        cache = self.market.data_cache
        snapshot = cache.read(key, loader, ttl, PEER_DISCOVERY.max_stale)
        if snapshot["data"] is None and key in cache.tasks:
            await asyncio.shield(cache.tasks[key])
            snapshot = cache.read(key, loader, ttl, PEER_DISCOVERY.max_stale)
        if snapshot["data"] is None:
            raise ValueError("peer_reference_unavailable")
        return snapshot["data"]

    async def profile(self, symbol):
        return await self.reference(
            "security-profile:" + symbol, lambda: self.market.yahoo._dataset(symbol, "profile")
        )

    async def discover(self, symbol):
        profile = await self.profile(symbol)
        industry = profile.get("industry")
        if not industry:
            raise ValueError("industry_unavailable")
        pool = await self.reference(
            "industry-peers:" + industry,
            lambda: self.market.yahoo._dataset(industry, "industry_peers"),
        )
        suggested = []
        if "." not in symbol:
            try:
                raw = await self.market.get("Finnhub", "stock/peers", {"symbol": symbol})
                suggested = raw if isinstance(raw, list) else []
            except Exception:
                pass
        fx = await self.reference(
            "peer-selection-fx", lambda: self.market.yahoo._dataset("USD", "currency_rates"), 86400
        )
        selected = choose(symbol, profile, pool, suggested, fx["rates"])
        if not selected:
            raise ValueError("no_verified_peers")
        return {"members": selected, "industry": industry}

    def read(self, symbol):
        automatic = self.cache.read(
            "peer-list:" + symbol, lambda: self.discover(symbol), PEER_DISCOVERY.ttl, PEER_DISCOVERY.max_stale
        )
        override = self.store.one("SELECT symbols FROM peer_selections WHERE symbol=?", (symbol,))
        members = (
            json.loads(override["symbols"])
            if override
            else (automatic["data"] or {}).get("members", [])
        )
        items = []
        refreshing = automatic["refreshing"]
        for member in members:
            peer = member["symbol"]
            snapshot = self.cache.read(
                "peer-row:" + peer, lambda s=peer: self.collect_row(s), PEER_QUOTE.ttl, PEER_QUOTE.max_stale
            )
            finance = self.market.financial_data.read(peer)
            refreshing = refreshing or snapshot["refreshing"] or finance["refreshing"]
            report = finance["data"] or {}
            fields = report.get("fields", {})
            item = {
                **member,
                "price": None,
                "market_cap": None,
                "pe": None,
                "beta": None,
                "growth": None,
                **(snapshot["data"] or {}),
                "mock": False,
                "state": snapshot["state"],
                "updated_at": snapshot["updated_at"],
                "financial_period": report.get("period"),
                "financial_currency": report.get("currency"),
            }
            for field in ("revenue", "ebitda", "gross_margin"):
                item[field] = fields.get(field, {}).get("value")
            item["financial_state"] = finance["state"]
            items.append(item)
        return {
            **automatic,
            "refreshing": refreshing,
            "data": {
                "members": items,
                "automatic_members": (automatic["data"] or {}).get("members", []),
                "selection": "manual" if override else "automatic",
            },
        }

    async def collect_row(self, symbol):
        from .dossier import basic_metrics

        quote, metrics = await asyncio.gather(
            self.market.quote(symbol), basic_metrics(self.market, symbol), return_exceptions=True
        )
        old = self.store.one(
            "SELECT payload FROM intelligence_snapshots WHERE key=?", ("peer-row:" + symbol,)
        )
        row = json.loads(old["payload"]) if old and old["payload"] else {}
        changed = False
        if not isinstance(quote, Exception) and quote.get("price") is not None:
            row.update(
                {
                    k: quote.get(k)
                    for k in ("name", "price", "currency", "market_cap", "change_percent", "as_of")
                    if quote.get(k) is not None
                }
            )
            row["quote_updated_at"] = time.time()
            changed = True
        if not isinstance(metrics, Exception):
            for key in ("pe", "beta", "growth"):
                if metrics.get(key) is not None:
                    row[key] = metrics[key]
                    row.setdefault("metric_updated_at", {})[key] = time.time()
                    changed = True
            row["metric_sources"] = {**row.get("metric_sources", {}), **metrics.get("sources", {})}
        if not changed:
            raise ValueError("peer_metrics_unavailable")
        return row

    async def save(self, symbol, symbols):
        if symbols is None:
            self.store.execute("DELETE FROM peer_selections WHERE symbol=?", (symbol,))
        else:
            normalized = list(dict.fromkeys(canonical(s) for s in symbols))
            if symbol in normalized or not 1 <= len(normalized) <= 6:
                raise ValueError("Select one to six other companies")
            members = []
            profiles = await asyncio.gather(*(self.profile(peer) for peer in normalized))
            for peer, profile in zip(normalized, profiles):
                members.append(
                    {
                        "symbol": peer,
                        "name": profile["name"],
                        "currency": profile["currency"],
                        "reason": "用户选择",
                        "source": "manual",
                    }
                )
            self.store.execute(
                "INSERT INTO peer_selections(symbol,symbols) VALUES (?,?) ON CONFLICT(symbol) DO UPDATE SET symbols=excluded.symbols",
                (symbol, json.dumps(members)),
            )
        return self.read(symbol)

    async def run(self):
        while True:
            try:
                for row in self.store.all("SELECT symbol FROM coverage WHERE active=1"):
                    self.read(row["symbol"])
                self.last_tick = time.time()
            except Exception:
                logging.getLogger(__name__).exception("Peer refresh scan failed")
            await asyncio.sleep(15)
