import asyncio
import json
import math
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .cache import MissingConfiguration
from .calendar_values import actual_value


def numeric(value):
    if value is None or value in ("", ".", "--"):
        return None
    number = float(value)
    return number if math.isfinite(number) else None


class Sources:
    def __init__(self, transport):
        self.http = transport
        self.ak_gate = asyncio.Semaphore(1)
        self.tickers = None
        self.ticker_lock = asyncio.Lock()

    async def china(self, symbol, kind):
        async with self.ak_gate:
            process = await asyncio.create_subprocess_exec(
                sys.executable,
                str(Path(__file__).with_name("china_worker.py")),
                symbol,
                kind,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout, _ = await asyncio.wait_for(process.communicate(), 30)
                if process.returncode:
                    raise ValueError("public_disclosure_unavailable")
                return json.loads(stdout)
            finally:
                if process.returncode is None:
                    process.kill()
                    await process.wait()

    async def fred(self, series, label, unit):
        key = os.getenv("FRED_API_KEY")
        if not key:
            raise MissingConfiguration()
        raw = await self.http.json(
            "fred",
            "https://api.stlouisfed.org/fred/series/observations",
            {
                "api_key": key,
                "file_type": "json",
                "series_id": series,
                "sort_order": "desc",
                "limit": 10000,
            },
        )
        points = [
            {"date": r["date"], "value": numeric(r["value"])}
            for r in raw["observations"]
            if numeric(r["value"]) is not None
        ]
        if not points:
            raise ValueError("empty series")
        return {
            "label": label,
            "unit": unit,
            "points": sorted(points, key=lambda p: p["date"]),
            "source": "FRED",
            "source_url": "https://fred.stlouisfed.org/series/" + series,
        }

    async def akshare(self, metric):
        async with self.ak_gate:
            process = await asyncio.create_subprocess_exec(
                sys.executable,
                str(Path(__file__).with_name("akshare_worker.py")),
                metric,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout, _ = await asyncio.wait_for(process.communicate(), 22)
                if process.returncode:
                    raise ValueError("akshare unavailable")
                return json.loads(stdout)
            finally:
                if process.returncode is None:
                    process.kill()
                    await process.wait()

    async def calendar(self, start=None, end=None):
        key = os.getenv("JBLANKED_API_KEY")
        if not key:
            raise MissingConfiguration()
        raw = await self.http.json(
            "jblanked",
            "https://www.jblanked.com/news/api/mql5/calendar/range/"
            if start and end
            else "https://www.jblanked.com/news/api/mql5/calendar/week/",
            params={"from": start, "to": end} if start and end else None,
            headers={"Authorization": "Api-Key " + key, "Content-Type": "application/json"},
        )
        events = []
        for row in raw:
            at = datetime.strptime(row["Date"], "%Y.%m.%d %H:%M:%S").replace(
                tzinfo=timezone(timedelta(hours=3))
            )
            actual, status = actual_value(row.get("Actual"), at.isoformat())
            events.append(
                {
                    "title": row["Name"],
                    "at": at.astimezone(timezone.utc).isoformat(),
                    "currency": row["Currency"],
                    "impact": row.get("Impact"),
                    "actual": actual,
                    "actual_status": status,
                    "forecast": row.get("Forecast"),
                    "previous": row.get("Previous"),
                }
            )
        return {
            "events": sorted(events, key=lambda r: r["at"]),
            "source": "JBlanked / MQL5",
            "source_url": "https://www.jblanked.com/news/api/docs/calendar/",
        }

    async def research(self, company):
        query = company + " annual report investor relations revenue retention cash flow"
        for source, key_name in [("Tavily", "TAVILY_API_KEY"), ("Exa", "EXA_API_KEY")]:
            key = os.getenv(key_name)
            if not key:
                continue
            try:
                if source == "Tavily":
                    raw = await self.http.json(
                        "tavily",
                        "https://api.tavily.com/search",
                        headers={"Authorization": "Bearer " + key},
                        body={
                            "query": query,
                            "search_depth": "basic",
                            "max_results": 5,
                            "include_answer": False,
                        },
                    )
                else:
                    raw = await self.http.json(
                        "exa",
                        "https://api.exa.ai/search",
                        headers={"x-api-key": key},
                        body={
                            "query": query,
                            "numResults": 5,
                            "contents": {"text": {"maxCharacters": 1200}},
                        },
                    )
                items = [
                    {
                        "title": r.get("title") or r["url"],
                        "url": r["url"],
                        "snippet": (r.get("content") or r.get("text") or "")[:1200],
                    }
                    for r in raw.get("results", [])
                    if r.get("url", "").startswith("https://")
                ]
                if items:
                    return {"items": items, "source": source, "verified": False}
            except (RuntimeError, ValueError, KeyError):
                continue
        raise RuntimeError("research_sources_unavailable")

    async def sec_identity(self, symbol):
        agent = os.getenv("SEC_USER_AGENT")
        if not agent:
            raise MissingConfiguration()
        headers = {"User-Agent": agent, "Accept-Encoding": "gzip, deflate"}
        async with self.ticker_lock:
            if self.tickers is None:
                raw = await self.http.json(
                    "sec", "https://www.sec.gov/files/company_tickers.json", headers=headers
                )
                self.tickers = {r["ticker"]: str(r["cik_str"]).zfill(10) for r in raw.values()}
        cik = self.tickers.get(symbol)
        return cik, headers

    async def disclosures(self, symbol):
        cik, headers = await self.sec_identity(symbol)
        if not cik:
            return {"filings": [], "complete": True, "source": "SEC EDGAR"}
        raw = await self.http.json(
            "sec", f"https://data.sec.gov/submissions/CIK{cik}.json", headers=headers
        )
        records = filings(raw, cik, limit=None)
        archives = raw.get("filings", {}).get("files", [])
        for archive in archives[:12]:
            name = archive["name"]
            if not name.startswith("CIK" + cik) or "/" in name:
                raise ValueError("invalid submissions archive")
            older = await self.http.json(
                "sec", "https://data.sec.gov/submissions/" + name, headers=headers
            )
            records.extend(filings({"filings": {"recent": older}}, cik, limit=None))
        unique = {r["url"]: r for r in records}
        return {
            "filings": sorted(unique.values(), key=lambda r: r["date"], reverse=True),
            "complete": len(archives) <= 12,
            "source": "SEC EDGAR",
        }


def filings(submissions, cik, limit=6):
    recent = submissions.get("filings", {}).get("recent", {})
    result = []
    for i, form in enumerate(recent.get("form", [])):
        if form.split("/")[0] not in ["10-K", "10-Q", "8-K", "20-F", "6-K"]:
            continue
        accession = recent["accessionNumber"][i].replace("-", "")
        document = recent["primaryDocument"][i]
        result.append(
            {
                "form": form,
                "date": recent["filingDate"][i],
                "url": f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession}/{document}",
            }
        )
        if limit is not None and len(result) == limit:
            break
    return result
