import asyncio
import time

import httpx
from ..cache_policy import UPSTREAM_RETRY_SECONDS


class SourceTransport:
    def __init__(self):
        self.gates = {}
        self.next_allowed = {}

    async def json(self, source, url, params=None, headers=None, body=None):
        gate = self.gates.setdefault(source, asyncio.Lock())
        async with gate:
            wait = self.next_allowed.get(source, 0) - time.monotonic()
            if wait > 5:
                raise RuntimeError("source cooling down")
            if wait > 0:
                await asyncio.sleep(wait)
            for attempt in range(2):
                async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
                    response = await client.request(
                        "POST" if body is not None else "GET",
                        url,
                        params=params,
                        headers=headers,
                        json=body,
                    )
                self.next_allowed[source] = time.monotonic() + 1.1
                if response.status_code == 429:
                    self.next_allowed[source] = time.monotonic() + UPSTREAM_RETRY_SECONDS
                    raise RuntimeError("rate limited")
                if response.status_code in (502, 503, 504) and attempt == 0:
                    await asyncio.sleep(0.5)
                    continue
                if response.status_code != 200:
                    raise RuntimeError("source unavailable")
                return response.json()
            raise RuntimeError("source unavailable")
