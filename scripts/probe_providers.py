"""Secret-safe provider probe; run through infisical run."""

import json
import os
import urllib.error
import urllib.parse
import urllib.request


def request(name, url, params=None, body=None, headers=None):
    try:
        if params:
            url += "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(
            url, data=json.dumps(body).encode() if body else None, headers=headers or {}
        )
        with urllib.request.urlopen(req, timeout=20) as res:
            data = json.load(res)
            print(
                name,
                "HTTP",
                res.status,
                "items",
                len(data) if isinstance(data, (dict, list)) else type(data).__name__,
                flush=True,
            )
    except urllib.error.HTTPError as e:
        print(name, "HTTP", e.code, flush=True)
    except Exception as e:
        print(name, type(e).__name__, flush=True)


print("Model:", os.getenv("OPENAI_MODEL"), flush=True)
print(
    "Endpoint host:",
    urllib.parse.urlsplit(os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")).hostname,
    flush=True,
)
request(
    "FMP quote",
    "https://financialmodelingprep.com/stable/quote",
    {"symbol": "AAPL", "apikey": os.getenv("FMP_API_KEY", "")},
)
request(
    "FMP statements",
    "https://financialmodelingprep.com/stable/income-statement",
    {"symbol": "AAPL", "limit": 1, "apikey": os.getenv("FMP_API_KEY", "")},
)
request(
    "Finnhub quote",
    "https://finnhub.io/api/v1/quote",
    {"symbol": "AAPL", "token": os.getenv("FINNHUB_API_KEY", "")},
)
request(
    "Model",
    os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/") + "/chat/completions",
    body={
        "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        "messages": [{"role": "user", "content": "Reply with OK only."}],
        "max_tokens": 8,
    },
    headers={
        "Authorization": "Bearer " + os.getenv("OPENAI_API_KEY", ""),
        "Content-Type": "application/json",
    },
)
