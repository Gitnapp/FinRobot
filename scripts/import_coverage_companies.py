"""Import the user-approved research directory, preserving existing coverage settings."""

import asyncio
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

from finrobot_equity.research_desk.store import Store, now


async def main():
    load_dotenv(".env", override=True, interpolate=False)
    store = Store()
    store.init()
    rows = json.loads(Path("data/coverage-companies.json").read_text())
    linked = 0
    for index, company in enumerate(rows):
        if company.get("symbol"):
            symbol = company["symbol"]
            with store.connection() as db:
                db.execute("INSERT OR IGNORE INTO assets VALUES (?,?)", (symbol, now()))
                due = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
                db.execute(
                    "INSERT OR IGNORE INTO coverage(symbol,cadence,active,next_run) VALUES (?,'weekly',1,?)",
                    (symbol, due),
                )
            linked += 1
        store.execute(
            "INSERT INTO coverage_companies VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
            (company["id"], json.dumps(company, ensure_ascii=False)),
        )
    Path("data/coverage-companies.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2))
    print("Imported", len(rows), "companies; enabled", linked, "verified securities")


if __name__ == "__main__":
    asyncio.run(main())
