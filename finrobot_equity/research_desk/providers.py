"""Credential and HTTP boundary shared by every external market adapter."""

import asyncio
import os
import time

import httpx


class ProviderError(Exception):
    pass


class ProviderClient:
    CONFIG = {
        "FMP": ("https://financialmodelingprep.com/stable/", "FMP_API_KEY", "apikey"),
        "Finnhub": ("https://finnhub.io/api/v1/", "FINNHUB_API_KEY", "token"),
        "Adanos": ("https://api.adanos.org/", "ADANOS_API_KEY", None),
    }

    def __init__(self):
        self.gate = asyncio.Semaphore(3)
        self.cooldown = {}

    async def get(self, provider, endpoint, params):
        root, key_name, key_param = self.CONFIG[provider]
        key = os.getenv(key_name)
        if not key:
            raise ProviderError("not_configured")
        if self.cooldown.get(provider, 0) > time.time():
            raise ProviderError("rate_limited")
        query = dict(params)
        headers = {}
        if key_param:
            query[key_param] = key
        else:
            headers["X-API-Key"] = key
        try:
            async with asyncio.timeout(10):
                async with self.gate:
                    async with httpx.AsyncClient(timeout=8) as client:
                        response = await client.get(root + endpoint, params=query, headers=headers)
            if response.status_code == 429:
                self.cooldown[provider] = time.time() + 900
                raise ProviderError("rate_limited")
            if response.status_code in (401, 403):
                raise ProviderError("access_denied")
            if response.status_code == 404:
                raise ProviderError("not_found")
            if response.status_code != 200:
                raise ProviderError("unavailable")
            data = response.json()
            if isinstance(data, dict) and (data.get("error") or data.get("Error Message")):
                raise ProviderError("invalid_response")
            return data
        except (httpx.HTTPError, TimeoutError, ValueError):
            # Do not expose request URLs or provider response bodies containing credentials.
            raise ProviderError("unavailable") from None
