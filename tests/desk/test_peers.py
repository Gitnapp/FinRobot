import asyncio
from contextlib import suppress

from finrobot_equity.research_desk.intelligence.cache import SnapshotCache
from finrobot_equity.research_desk.peers import Peers, canonical, choose
from finrobot_equity.research_desk.providers import ProviderError
from finrobot_equity.research_desk.store import Store


def test_candidate_identity_currency_size_and_deduplication():
    profile = {
        "name": "Subject Inc.",
        "industry": "Hardware",
        "currency": "USD",
        "market_cap": 1000,
    }

    def candidate(symbol, name, cap, currency="USD", exchange="NMS"):
        return dict(
            symbol=symbol,
            longName=name,
            marketCap=cap,
            currency=currency,
            exchange=exchange,
            quoteType="EQUITY",
        )

    rows = [
        candidate("OWN", "Subject Inc.", 1000),
        candidate("SAME", "Comparable Inc.", 800),
        candidate("005930.KS", "Foreign Inc.", 900000, "KRW", "KSC"),
        candidate("005935.KS", "Foreign Inc.", 100000, "KRW", "KSC"),
        candidate("EMPTYW", "Unknown Size Warrant", 0),
        candidate("FUND", "Fund", 500),
        candidate("TINY", "Small Inc.", 1),
        candidate("0700.HK", "HK Company", 6000, "HKD", "HKG"),
    ]
    rows[5]["quoteType"] = "ETF"
    selected = choose("OWN", profile, rows, [], {"USD": 1, "KRW": 0.001, "HKD": 0.125})
    assert [p["symbol"] for p in selected] == ["005930.KS", "SAME", "00700.HK", "TINY"]
    assert canonical("688256.SS") == "688256.SH"
    assert len({p["name"] for p in selected}) == len(selected)


class Market:
    def __init__(self, store):
        self.data_cache = SnapshotCache(store)
        self.financial_data = self

    def read(self, symbol):
        return {
            "state": "ready",
            "refreshing": False,
            "data": {
                "period": "2025-12-31",
                "currency": "USD",
                "fields": {"ebitda": {"value": 123}},
            },
        }


def service(tmp_path):
    store = Store(tmp_path)
    store.init()
    market = Market(store)
    peers = Peers(store, market)

    async def discover(symbol):
        return {
            "members": [
                {
                    "symbol": "TEST",
                    "name": "Test company",
                    "currency": "USD",
                    "reason": "same industry",
                    "source": "test",
                }
            ]
        }

    async def row(symbol):
        return {"price": 25, "currency": "USD", "pe": 12}

    peers.discover = discover
    peers.collect_row = row
    return store, market, peers


def test_background_all_markets_and_persisted_manual_selection(tmp_path):
    store, market, peers = service(tmp_path)
    for symbol, active in [("AAPL", 1), ("00700.HK", 1), ("688256.SH", 1), ("MSFT", 0)]:
        store.execute("INSERT OR IGNORE INTO assets VALUES (?, '2026-01-01')", (symbol,))
        store.execute(
            "INSERT INTO coverage(symbol,cadence,active) VALUES (?,'weekly',?)", (symbol, active)
        )

    async def run():
        runner = asyncio.create_task(peers.run())
        await asyncio.sleep(0)
        await asyncio.gather(*list(peers.cache.tasks.values()))
        assert (
            store.one(
                "SELECT COUNT(*) AS n FROM intelligence_snapshots WHERE key LIKE 'peer-list:%'"
            )["n"]
            == 3
        )

        async def profile(symbol):
            return {"name": symbol + " company", "currency": "USD"}

        peers.profile = profile
        await peers.save("AAPL", ["MANUAL"])
        store.execute("UPDATE intelligence_snapshots SET expires=0 WHERE key='peer-list:AAPL'")
        peers.read("AAPL")
        await asyncio.gather(*list(peers.cache.tasks.values()))
        assert peers.read("AAPL")["data"]["members"][0]["symbol"] == "MANUAL"
        restarted = Peers(store, market)
        assert restarted.read("AAPL")["data"]["selection"] == "manual"
        await restarted.cache.close()
        await peers.save("AAPL", None)
        assert peers.read("AAPL")["data"]["members"][0]["symbol"] == "TEST"
        runner.cancel()
        with suppress(asyncio.CancelledError):
            await runner
        await peers.cache.close()
        await market.data_cache.close()

    asyncio.run(run())


def test_one_failed_row_does_not_clear_comparison(tmp_path):
    store, market, peers = service(tmp_path)

    async def run():
        peers.read("AAPL")
        await asyncio.gather(*list(peers.cache.tasks.values()))
        peers.read("AAPL")
        await asyncio.gather(*list(peers.cache.tasks.values()))
        old = peers.read("AAPL")["data"]["members"][0]

        async def broken(symbol):
            raise ProviderError("offline")

        peers.collect_row = broken
        store.execute("UPDATE intelligence_snapshots SET expires=0 WHERE key='peer-row:TEST'")
        peers.read("AAPL")
        await asyncio.gather(*list(peers.cache.tasks.values()))
        row = peers.read("AAPL")["data"]["members"][0]
        assert row["price"] == old["price"] == 25
        assert row["state"] == "stale" and row["updated_at"] == old["updated_at"]
        assert row["ebitda"] == 123
        await peers.cache.close()
        await market.data_cache.close()

    asyncio.run(run())
