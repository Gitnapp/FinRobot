"""Research facts and deterministic analytics shared by Coverage and report charts."""

import asyncio
import math

from .market import CATALOG, ProviderError
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
        "unit": "USD million",
        "note": "以 EBIT 税后利润加折旧、减资本开支与营运资金计算企业现金流；未扣净债务，不换算目标股价。",
    }


async def basic_metrics(market, symbol):
    sample = {
        "pe": {"NVDA": 34.2, "AMD": 45.8, "AVGO": 28.7, "AAPL": 29.4, "MSFT": 31.2}.get(
            symbol, 26.3
        ),
        "beta": 1.35,
        "growth": 20.0,
        "mock": True,
    }

    async def fetch(mode):
        if mode == "mock":
            return sample
        try:
            raw = await market.get("Finnhub", "stock/metric", {"symbol": symbol, "metric": "all"})
            m = raw["metric"]

            def number(key):
                value = m.get(key)
                return float(value) if value is not None and math.isfinite(float(value)) else None

            return {
                "pe": number("peTTM") if number("peTTM") is not None else sample["pe"],
                "beta": number("beta") if number("beta") is not None else sample["beta"],
                "growth": number("revenueGrowthTTMYoy"),
                "low": number("52WeekLow"),
                "high": number("52WeekHigh"),
                "mock": number("peTTM") is None or number("beta") is None,
            }
        except (ProviderError, ValueError, TypeError, KeyError):
            return sample

    return await market.cached("metrics:" + symbol, fetch, 21600)


async def compose(market, symbol, assumptions=None):
    quote, base, history, news, metrics = await asyncio.gather(
        market.quote(symbol),
        market.fundamentals(symbol),
        market.history(symbol),
        market.news(symbol),
        basic_metrics(market, symbol),
    )
    model = compute_model(base, assumptions)
    peers = [r for r in CATALOG if r[2] == quote["sector"] and r[0] != symbol][:3]
    if not peers:
        peers = [r for r in CATALOG if r[0] in ["MSFT", "AAPL", "GOOGL"] and r[0] != symbol][:3]
    peer_quotes = await asyncio.gather(*(market.quote(r[0]) for r in peers))
    peer_metrics = await asyncio.gather(*(basic_metrics(market, r[0]) for r in peers))
    comparisons = [
        {
            "symbol": p["symbol"],
            "name": p["name"],
            "price": p["price"],
            "market_cap": p["market_cap"],
            "change_percent": p["change_percent"],
            **m,
        }
        for p, m in zip(peer_quotes, peer_metrics)
    ]
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
