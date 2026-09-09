import asyncio

from finrobot_equity.research_desk.assumption_policy import AssumptionPolicy
from finrobot_equity.research_desk.intelligence.cache import SnapshotCache
from finrobot_equity.research_desk.schemas import Assumptions
from finrobot_equity.research_desk.store import Store


def test_recommendations_preserve_edits_across_refresh_and_restart(tmp_path, monkeypatch):
    store = Store(tmp_path)
    store.init()
    cache = SnapshotCache(store)
    cache.init()
    policy = AssumptionPolicy(store, None, cache)
    values = Assumptions().model_dump()

    async def proposal(*args):
        return {"assumptions": values.copy(), "rationale": {}, "as_of": "2026-01-01"}

    monkeypatch.setattr("finrobot_equity.research_desk.assumption_policy.propose", proposal)

    async def run():
        await policy.refresh("NVDA")
        assert policy.read("NVDA")["effective"] == values
        policy.save("NVDA", {"growth": 0.31})
        values.update(growth=0.4, gross_margin=0.7)
        await policy.refresh("NVDA")
        fresh = AssumptionPolicy(store, None, cache).read("NVDA")
        assert fresh["effective"]["growth"] == 0.31
        assert fresh["effective"]["gross_margin"] == 0.7
        assert fresh["overrides"] == {"growth": 0.31}

        entered, release = asyncio.Event(), asyncio.Event()

        async def delayed(*args):
            entered.set()
            await release.wait()
            return {"assumptions": values.copy(), "rationale": {}, "as_of": "2026-01-01"}

        monkeypatch.setattr("finrobot_equity.research_desk.assumption_policy.propose", delayed)
        task = asyncio.create_task(policy.refresh("NVDA"))
        await entered.wait()
        policy.save("NVDA", {"gross_margin": .65})
        release.set()
        await task
        fresh = policy.read("NVDA")
        assert fresh["effective"]["gross_margin"] == .65
        assert fresh["effective"]["growth"] == .31

        policy.save("NVDA", {"growth": None})
        assert policy.read("NVDA")["effective"]["growth"] == .4
        assert policy.overrides("NVDA") == {"gross_margin": .65}
        values.update(growth=.45, gross_margin=.8)
        monkeypatch.setattr("finrobot_equity.research_desk.assumption_policy.propose", proposal)
        await policy.refresh("NVDA")
        fresh = policy.read("NVDA")
        assert fresh["effective"]["growth"] == .45
        assert fresh["effective"]["gross_margin"] == .65

        async def fail(*args):
            raise RuntimeError("unavailable")

        monkeypatch.setattr("finrobot_equity.research_desk.assumption_policy.propose", fail)
        await policy.refresh("NVDA")
        assert policy.read("NVDA")["effective"] == fresh["effective"]
        await cache.close()

    asyncio.run(run())


def test_scenarios_keep_independent_edits_and_reset(tmp_path, monkeypatch):
    from finrobot_equity.research_desk.model import scenario_assumptions
    store = Store(tmp_path)
    store.init()
    cache = SnapshotCache(store)
    cache.init()
    policy = AssumptionPolicy(store, None, cache)
    values = Assumptions().model_dump()

    async def proposal(*args):
        return {"assumptions": values.copy(), "rationale": {}}

    monkeypatch.setattr("finrobot_equity.research_desk.assumption_policy.propose", proposal)

    async def run():
        await policy.refresh("NVDA")
        for case, growth in [("base", .2), ("bear", .1), ("bull", .4)]:
            policy.save("NVDA", {"growth": growth}, case)
        restarted = AssumptionPolicy(store, None, cache)
        for case, growth in [("base", .2), ("bear", .1), ("bull", .4)]:
            assert restarted.read("NVDA", case)["effective"]["growth"] == growth
            effective = scenario_assumptions(store.assumptions("NVDA"), case, restarted.overrides("NVDA", case))
            assert effective["growth"] == growth
        await restarted.refresh("NVDA")
        assert restarted.read("NVDA", "bull")["effective"]["growth"] == .4
        restarted.save("NVDA", {"growth": None}, "bear")
        assert restarted.read("NVDA", "bear")["effective"]["growth"] == .2 - .08
        assert restarted.read("NVDA", "base")["effective"]["growth"] == .2
        assert restarted.read("NVDA", "bull")["effective"]["growth"] == .4
        await cache.close()

    asyncio.run(run())
