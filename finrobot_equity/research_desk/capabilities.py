"""Audited provider capabilities for the application, not advertised availability."""

import os

from .financial_data.registry import DERIVED, METRICS

PROVIDERS = [
    (
        "SEC EDGAR",
        "SEC_USER_AGENT",
        ["financials", "disclosures"],
        "https://www.sec.gov/search-filings/edgar-application-programming-interfaces",
        "US-GAAP/IFRS standard entity facts; custom tags require reported filings",
    ),
    (
        "Finnhub",
        "FINNHUB_API_KEY",
        ["financials", "company_metrics", "catalysts", "news"],
        "https://finnhub.io/docs/api",
        "Reported financial statements, earnings calendar, metrics and company news are wired; specific endpoint entitlements vary",
    ),
    (
        "FMP",
        "FMP_API_KEY",
        ["financials", "catalysts", "news"],
        "https://site.financialmodelingprep.com/developer/docs/stable/income-statement",
        "Annual statements are wired; calendar/news documented alternatives not selected by default; recent probes were rate limited",
    ),
    (
        "Yahoo Finance",
        None,
        ["prices", "financials", "security_metadata", "earnings_dates", "analyst_estimates"],
        "https://ranaroussi.github.io/yfinance/reference/api/yfinance.Ticker.html",
        "Prices, metadata and annual statements wired; earnings dates wired as an alternative; analyst estimates documented but not used as historical facts",
    ),
    (
        "AKShare",
        None,
        ["financials", "disclosures", "macro", "disclosure_schedule"],
        "https://akshare.akfamily.xyz/data/stock/stock.html",
        "A-share annual statements, CNINFO history and China macro wired; scheduled disclosure interface documented",
    ),
    (
        "TickFlow",
        "TICKFLOW_API_KEY",
        ["prices", "security_metadata"],
        "https://docs.tickflow.org/zh-Hans/sdk/python-quickstart",
        "Free daily bars; realtime quotes require paid key; not a financial statement source",
    ),
    (
        "Twelve Data",
        "TWELVE_DATA_API_KEY",
        ["prices", "financials", "earnings_dates", "analyst_estimates"],
        "https://twelvedata.com/docs/introduction/overview",
        "Key validated for US daily bars; foreign daily quotes explicitly require higher plans; not selected for production routing",
    ),
    (
        "FRED",
        "FRED_API_KEY",
        ["macro", "release_calendar"],
        "https://fred.stlouisfed.org/docs/api/fred/",
        "Series observations wired; release dates do not provide analyst forecasts",
    ),
    (
        "JBlanked",
        "JBLANKED_API_KEY",
        ["calendar"],
        "https://www.jblanked.com/news/api/docs/calendar/",
        "Week and range retrieval wired; free tier one request/day; last direct HTTP401 response explicitly requires credits (not an invalid key)",
    ),
    (
        "Adanos",
        "ADANOS_API_KEY",
        ["sentiment"],
        "https://api.adanos.org/docs",
        "Reddit stock sentiment wired; X/news/Polymarket are distinct populations, not interchangeable missing values",
    ),
    (
        "Tavily",
        "TAVILY_API_KEY",
        ["research"],
        "https://docs.tavily.com/documentation/api-reference/endpoint/search",
        "Search evidence only; snippets never become verified financial facts",
    ),
    (
        "Exa",
        "EXA_API_KEY",
        ["research"],
        "https://exa.ai/docs/reference/search",
        "Search evidence adapter wired; snippets never become verified financial facts",
    ),
    (
        "CNINFO",
        None,
        ["disclosures", "financials", "disclosure_schedule"],
        "https://webapi.cninfo.com.cn/",
        "Public announcements via AKShare wired; commercial structured API requires separate access",
    ),
]


def capability_inventory():
    return {
        "checked_at": "2026-09-09",
        "interface": "/api/data/{subject}/{dataset}",
        "datasets": [
            "metrics",
            "market_metrics",
            "company",
            "quote",
            "prices",
            "disclosures",
            "catalysts",
            "sentiment",
            "macro",
            "calendar",
            "research",
        ],
        "dataset_fields": {
            "quote": ["price", "change_percent", "market_cap", "currency", "as_of"],
            "prices": ["time", "open", "high", "low", "close", "volume"],
            "market_metrics": ["pe", "beta", "growth", "low", "high"],
            "catalysts": ["date", "title", "eps_estimate", "eps_actual", "revenue_estimate"],
            "sentiment": ["score", "buzz", "mentions", "bullish", "bearish", "trend"],
            "calendar": [
                "title",
                "at",
                "currency",
                "actual",
                "actual_status",
                "forecast",
                "previous",
            ],
            "macro": ["date", "value", "unit", "yoy", "mom"],
            "disclosures": ["form", "date", "url"],
        },
        "financial_fields": list(METRICS),
        "field_providers": {
            key: (["SEC EDGAR", "Finnhub reported financials"] if spec.sec else [])
            + (["FMP"] if spec.fmp else [])
            + (["Yahoo Finance"] if spec.yahoo else [])
            + (["calculated"] if key in DERIVED else [])
            for key, spec in METRICS.items()
        },
        "providers": [
            {
                "name": name,
                "configured": name == "TickFlow" or not key or bool(os.getenv(key)),
                "documented": capabilities,
                "documentation": url,
                "integration": note,
            }
            for name, key, capabilities, url, note in PROVIDERS
        ],
    }
