import os
import time

import httpx

start = time.monotonic()
try:
    with httpx.Client(timeout=30) as client:
        res = client.post(
            os.environ["OPENAI_BASE_URL"].rstrip("/") + "/chat/completions",
            headers={"Authorization": "Bearer " + os.environ["OPENAI_API_KEY"]},
            json={
                "model": os.environ["OPENAI_MODEL"],
                "messages": [{"role": "user", "content": "Reply OK only"}],
                "max_tokens": 12,
            },
        )
        print("HTTP", res.status_code, "duration", round(time.monotonic() - start, 1))
        if res.status_code == 200:
            d = res.json()
            print(
                "finish_reason",
                d["choices"][0].get("finish_reason"),
                "content_chars",
                len(d["choices"][0]["message"].get("content") or ""),
                "usage",
                d.get("usage"),
            )
except Exception as e:
    print(
        "exception",
        type(e).__name__,
        "cause",
        type(e.__cause__).__name__,
        "duration",
        round(time.monotonic() - start, 1),
    )
