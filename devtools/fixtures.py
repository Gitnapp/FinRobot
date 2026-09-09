import hashlib
import random
from datetime import date, timedelta

CATALOG = [("TEST", "测试公司（虚构）", "测试行业", 100, 1, 10000)]


def identity(symbol):
    row = next(
        (r for r in CATALOG if r[0] == symbol),
        (symbol, "测试公司（虚构）", "测试行业", 100, 0, 10000),
    )
    return dict(zip(("symbol", "name", "sector", "price", "change_percent", "revenue"), row))


def mock_base(symbol, reason="演示财务数据"):
    item = identity(symbol)
    rev = item["revenue"]
    return {
        "year": 2025,
        "revenue": rev,
        "cogs": rev * 0.60,
        "opex": rev * 0.20,
        "da": rev * 0.05,
        "interest": rev * 0.02,
        "tax": rev * 0.03,
        "capex": rev * 0.06,
        "nwc": rev * 0.02,
        "operating_income": rev * 0.15,
        "pretax": rev * 0.13,
        "net_income": rev * 0.10,
        "operating_cash_flow": rev * 0.13,
        "fcf": rev * 0.07,
        "currency": "USD",
        "growth": None,
        "source": "Demo · " + reason,
        "as_of": "2025-12-31",
        "mock": True,
    }


def mock_quote(symbol, reason="演示行情"):
    item = identity(symbol)
    return {
        **item,
        "market_cap": item["revenue"] * 1e6 * 12,
        "source": "Demo",
        "mock": True,
        "as_of": "2026-09-04T20:00:00+00:00",
        "note": reason,
        "currency": "USD",
    }


def mock_history(symbol):
    rng = random.Random(int(hashlib.sha256(symbol.encode()).hexdigest()[:10], 16))
    points = []
    start = date(2025, 9, 4)
    value = identity(symbol)["price"] * 0.64
    for i in range(366):
        day = start + timedelta(days=i)
        if day.weekday() > 4:
            continue
        opening = value
        value = max(1, value * (1 + rng.uniform(-0.035, 0.043)))
        points.append(
            {
                "time": day.isoformat(),
                "open": opening,
                "close": value,
                "high": max(opening, value) * (1 + rng.random() * 0.014),
                "low": min(opening, value) * (1 - rng.random() * 0.014),
            }
        )
    scale = identity(symbol)["price"] / points[-1]["close"]
    for point in points:
        for key in ("open", "close", "high", "low"):
            point[key] = round(point[key] * scale, 2)
    return {
        "points": points,
        "source": "Demo",
        "mock": True,
        "as_of": points[-1]["time"],
        "note": "固定种子的模拟走势，不代表历史价格",
    }
