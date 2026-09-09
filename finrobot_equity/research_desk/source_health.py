"""Small authenticated probes for the settings data-source status panel."""
import asyncio
import os
import time
import httpx


def classify(code, data):
    message = " ".join(str(data.get(key) or "") for key in ("message", "detail", "error", "Error Message")).lower() if isinstance(data, dict) else ""
    if any(phrase in message for phrase in ("requires credits", "insufficient credits", "insufficient balance", "quota exceeded", "credits exhausted")):
        return "limited", "额度不足"
    if "rate limit" in message or "too many requests" in message:
        return "limited", "请求限流"
    if code in (402, 429):
        return "limited", "限流或额度不足"
    if code >= 400:
        return "unavailable", "认证失败或接口无法访问"
    if isinstance(data, dict) and any(data.get(k) for k in ("error", "Error Message", "detail")):
        return "unavailable", "接口返回错误"
    return "available", "接口可用"


class SourceHealth:
    def __init__(self):
        self.result = None
        self.expires = 0
        self.lock = asyncio.Lock()

    async def read(self, sources):
        async with self.lock:
            if self.result is not None and self.expires > time.time():
                return self.result
            self.result = await asyncio.gather(*(self.probe(s) for s in sources))
            self.expires = time.time() + 300
            return self.result

    async def probe(self, source):
        name = source["name"]
        if not source["configured"]:
            return {**source, "status": "unconfigured", "reason": "未配置"}
        env = os.getenv
        requests = {
            "Yahoo Finance": ("https://query1.finance.yahoo.com/v8/finance/chart/AAPL", {"range": "5d", "interval": "1d"}, {}, None),
            "FRED": ("https://api.stlouisfed.org/fred/series/observations", {"series_id": "DFF", "api_key": env("FRED_API_KEY"), "file_type": "json", "limit": 1, "sort_order": "desc"}, {}, None),
            "JBlanked": ("https://www.jblanked.com/news/api/mql5/calendar/week/", {}, {"Authorization": "Api-Key " + (env("JBLANKED_API_KEY") or "")}, None),
            "SEC EDGAR": ("https://data.sec.gov/submissions/CIK0000320193.json", {}, {"User-Agent": env("SEC_USER_AGENT") or ""}, None),
            "TickFlow": ("https://api.tickflow.org/v1/instruments", {"symbols": "AAPL.US"}, {"X-API-Key": env("TICKFLOW_API_KEY") or ""}, None),
            "Finnhub": ("https://finnhub.io/api/v1/quote", {"symbol": "AAPL", "token": env("FINNHUB_API_KEY")}, {}, None),
            "FMP": ("https://financialmodelingprep.com/stable/profile", {"symbol": "AAPL", "apikey": env("FMP_API_KEY")}, {}, None),
            "Tavily": ("https://api.tavily.com/search", {}, {"Authorization": "Bearer " + (env("TAVILY_API_KEY") or "")}, {"query": "Apple investor relations", "max_results": 1, "search_depth": "basic"}),
            "Exa": ("https://api.exa.ai/search", {}, {"x-api-key": env("EXA_API_KEY") or ""}, {"query": "Apple investor relations", "numResults": 1}),
        }
        url, params, headers, body = requests[name]
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                response = await client.request("POST" if body else "GET", url, params=params, headers=headers, json=body)
            try:
                data = response.json()
            except ValueError:
                data = {"error": True}
            status, reason = classify(response.status_code, data)
        except httpx.HTTPError:
            status, reason = "unavailable", "连接失败或超时"
        return {**source, "status": status, "reason": reason}
