"""Automatic recommendations with durable, field-level user ownership."""

import json

from .assumption_advisor import propose
from .schemas import Assumptions
from .model import scenario_assumptions
from .store import now


class AssumptionPolicy:
    def __init__(self, store, market, cache):
        self.store, self.market, self.cache = store, market, cache

    def overrides(self, symbol, scenario="base"):
        if scenario != "base":
            row = self.store.one("SELECT values_json FROM scenario_overrides WHERE symbol=? AND scenario=?", (symbol, scenario))
            return json.loads(row["values_json"]) if row else {}
        row = self.store.one(
            "SELECT values_json FROM assumption_overrides WHERE symbol=?", (symbol,)
        )
        return json.loads(row["values_json"]) if row else {}

    def ttl(self, symbol):
        row = self.store.one("SELECT cadence FROM coverage WHERE symbol=?", (symbol,))
        return 86400 if row and row["cadence"] == "daily" else 7 * 86400

    async def collect(self, symbol):
        proposal = await propose(self.market, self.store, symbol)
        # Read overrides at commit time: an edit made during generation always wins.
        with self.store.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute(
                "SELECT values_json FROM assumption_overrides WHERE symbol=?", (symbol,)
            ).fetchone()
            overrides = json.loads(row["values_json"]) if row else {}
            effective = Assumptions.model_validate({**proposal["assumptions"], **overrides})
            db.execute(
                "INSERT OR REPLACE INTO models VALUES (?,?,?)",
                (symbol, effective.model_dump_json(), now()),
            )
        return proposal

    def read(self, symbol, scenario="base"):
        snapshot = self.cache.read(
            "assumptions:" + symbol, lambda: self.collect(symbol), self.ttl(symbol), 365 * 86400
        )
        if scenario != "base":
            original = snapshot["data"]
            recommended = scenario_assumptions(self.store.assumptions(symbol), scenario) if original else None
            return {**snapshot, "data": {**original, "assumptions": recommended} if original else None,
                    "effective": scenario_assumptions(recommended, "base", self.overrides(symbol, scenario)) if recommended else None,
                    "overrides": self.overrides(symbol, scenario)}
        return {
            **snapshot,
            "effective": self.store.assumptions(symbol) if snapshot["data"] else None,
            "overrides": self.overrides(symbol),
        }

    async def refresh(self, symbol):
        key = "assumptions:" + symbol
        self.store.execute(
            "UPDATE intelligence_snapshots SET expires=0,retry_after=0 WHERE key=?", (key,)
        )
        self.read(symbol)
        task = self.cache.tasks.get(key)
        if task:
            await task
        else:
            await self.cache.refresh(key, lambda: self.collect(symbol), self.ttl(symbol))

    def save(self, symbol, patch, scenario="base"):
        if scenario != "base":
            with self.store.connection() as db:
                db.execute("BEGIN IMMEDIATE")
                row = db.execute("SELECT values_json FROM scenario_overrides WHERE symbol=? AND scenario=?", (symbol, scenario)).fetchone()
                overrides = json.loads(row["values_json"]) if row else {}
                for key, value in patch.items():
                    if key not in Assumptions.model_fields:
                        raise ValueError("Unknown assumption")
                    if value is None: overrides.pop(key, None)
                    else: overrides[key] = value
                base = db.execute("SELECT assumptions FROM models WHERE symbol=?", (symbol,)).fetchone()
                if not base: raise ValueError("Assumptions unavailable")
                effective = scenario_assumptions(json.loads(base["assumptions"]), scenario, overrides)
                db.execute("INSERT OR REPLACE INTO scenario_overrides VALUES (?,?,?)", (symbol, scenario, json.dumps(overrides)))
            return effective
        with self.store.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute(
                "SELECT values_json FROM assumption_overrides WHERE symbol=?", (symbol,)
            ).fetchone()
            overrides = json.loads(row["values_json"]) if row else {}
            row = db.execute("SELECT assumptions FROM models WHERE symbol=?", (symbol,)).fetchone()
            effective = json.loads(row["assumptions"]) if row else {}
            snapshot = db.execute(
                "SELECT payload FROM intelligence_snapshots WHERE key=?", ("assumptions:" + symbol,)
            ).fetchone()
            recommended = (
                json.loads(snapshot["payload"])["assumptions"]
                if snapshot and snapshot["payload"]
                else {}
            )
            for key, value in patch.items():
                if key not in Assumptions.model_fields:
                    raise ValueError("Unknown assumption")
                if value is None:
                    if key not in recommended:
                        raise ValueError("Recommendation unavailable")
                    overrides.pop(key, None)
                    effective[key] = recommended[key]
                else:
                    overrides[key] = value
                    effective[key] = value
            effective = Assumptions.model_validate(effective)
            db.execute(
                "INSERT OR REPLACE INTO assumption_overrides VALUES (?,?)",
                (symbol, json.dumps(overrides)),
            )
            db.execute(
                "INSERT OR REPLACE INTO models VALUES (?,?,?)",
                (symbol, effective.model_dump_json(), now()),
            )
        return effective.model_dump()
