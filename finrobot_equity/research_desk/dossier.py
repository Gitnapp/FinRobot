"""Research facts and deterministic analytics shared by Coverage and report charts."""

import asyncio
import math

from .market import ProviderError
from .model import compute_model


def technical(history):
    prices = [p["close"] for p in history["points"]]
    daily = [prices[i] / prices[i - 1] - 1 for i in range(1, len(prices))]
    mean = sum(daily) / max(1, len(daily))
    volatility = (sum((r - mean) ** 2 for r in daily) / max(1, len(daily))) ** 0.5 * 252**0.5
    peak = prices[0]
    drawdown = 0
    for p in prices:
        peak = max(peak, p)
        drawdown = min(drawdown, p / peak - 1)
    low = min(p["low"] for p in history["points"])
    high = max(p["high"] for p in history["points"])
    return {
        "sma20": sum(prices[-20:]) / len(prices[-20:]),
        "sma50": sum(prices[-50:]) / len(prices[-50:]),
        "sma200": sum(prices[-200:]) / len(prices[-200:]),
        "low": low,
        "high": high,
        "return_year": prices[-1] / prices[0] - 1,
        "volatility": volatility,
        "drawdown": drawdown,
        "range_position": (prices[-1] - low) / (high - low) if high > low else 0.5,
        "trend": "上行" if prices[-1] > sum(prices[-50:]) / len(prices[-50:]) else "整理",
        "mock": history["mock"],
    }


def valuation(base, model):
    rows = {r["key"]: r["values"] for r in model["rows"]}
    # This is an enterprise-value DCF using unlevered operating cash flows, not the
    # simple model's net-income FCF. Never infer share count or net debt from spot price.
    if any(rows[k][i] is None for k in ("ebit", "da", "capex", "nwc") for i in range(1, 4)):
        return None
    fcff = [
        rows["ebit"][i] * (1 - model["assumptions"]["tax_rate"])
        + rows["da"][i]
        - rows["capex"][i]
        - rows["nwc"][i]
        for i in range(1, 4)
    ]

    def ev(wacc, growth):
        return (
            sum(f / (1 + wacc) ** (i + 1) for i, f in enumerate(fcff))
            + fcff[-1] * (1 + growth) / (wacc - growth) / (1 + wacc) ** 3
        )

    matrix = [
        [round(ev(w, g), 1) for g in [0.02, 0.03, 0.04]] for w in [0.09, 0.10, 0.11, 0.12, 0.13]
    ]
    return {
        "enterprise_value": round(ev(0.11, 0.03), 1),
        "wacc": 0.11,
        "terminal_growth": 0.03,
        "wacc_axis": [0.09, 0.10, 0.11, 0.12, 0.13],
        "growth_axis": [0.02, 0.03, 0.04],
        "sensitivity": matrix,
        "fcff": fcff,
        "mock": base["mock"],
        "method": "经营现金流折现",
        "unit": base.get("currency", "USD") + " million",
        "note": "以 EBIT 税后利润加折旧、减资本开支与营运资金计算企业现金流；未扣净债务，不换算目标股价。",
    }


async def basic_metrics(market, symbol):
    async def fetch(mode):
        fields = {
            "pe": None,
            "beta": None,
            "growth": None,
            "low": None,
            "high": None,
            "mock": False,
            "sources": {},
        }
        aliases = {
            "pe": "peTTM",
            "beta": "beta",
            "growth": "revenueGrowthTTMYoy",
            "low": "52WeekLow",
            "high": "52WeekHigh",
        }
        try:
            raw = await market.get("Finnhub", "stock/metric", {"symbol": symbol, "metric": "all"})
            for key, alias in aliases.items():
                value = raw.get("metric", {}).get(alias)
                if value is not None and math.isfinite(float(value)):
                    fields[key] = float(value)
                    fields["sources"][key] = "Finnhub"
        except (ProviderError, ValueError, TypeError):
            pass
        if fields["pe"] is None or fields["beta"] is None:
            try:
                raw = await market.yahoo.statistics(symbol)
                for key, alias in {
                    "pe": "trailingPE",
                    "beta": "beta",
                    "low": "fiftyTwoWeekLow",
                    "high": "fiftyTwoWeekHigh",
                }.items():
                    value = raw.get(alias)
                    if fields[key] is None and value is not None:
                        fields[key] = value
                        fields["sources"][key] = "Yahoo Finance"
            except (ProviderError, ValueError, TypeError):
                pass
        return fields

    return await market.cached("market-metrics:" + symbol, fetch, 21600)


async def compose(market, symbol, assumptions=None):
    comparisons = market.peers.read(symbol)["data"]["members"]
    quote, base, history, news, metrics = await asyncio.gather(
        market.quote(symbol),
        market.fundamentals(symbol),
        market.history(symbol),
        market.news(symbol),
        basic_metrics(market, symbol),
    )
    if base is None:
        return {
            "quote": quote,
            "history": history,
            "market_only": True,
            "metrics": metrics,
            "technical": technical(history),
            "peers": comparisons,
            "news": news,
            "model": None,
            "fundamentals": None,
            "valuation": None,
        }
    model = compute_model(base, assumptions)
    return {
        "quote": quote,
        "fundamentals": base,
        "history": history,
        "news": news,
        "metrics": metrics,
        "model": model,
        "technical": technical(history),
        "valuation": valuation(base, model),
        "peers": comparisons,
    }
