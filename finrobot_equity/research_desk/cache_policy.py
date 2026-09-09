"""Cache durations in seconds; polling frequency belongs to the frontend policy.

A successful read never extends the original snapshot lifetime. Refresh failure
keeps the last successful payload, subject to the policy's maximum age.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class CachePolicy:
    ttl: int
    max_stale: int


PRICE_SOURCE = CachePolicy(ttl=300, max_stale=2 * 86400)
PRICE_BUNDLE = CachePolicy(ttl=60, max_stale=86400)
COVERAGE_QUOTE = CachePolicy(ttl=60, max_stale=2 * 86400)
REFERENCE = CachePolicy(ttl=21600, max_stale=7 * 86400)
MACRO_DAILY = CachePolicy(ttl=86400, max_stale=7 * 86400)
CALENDAR_HISTORY = CachePolicy(ttl=86400, max_stale=30 * 86400)
CALENDAR_WEEK = CachePolicy(ttl=86400, max_stale=2 * 86400)
DISCLOSURES = CachePolicy(ttl=86400, max_stale=30 * 86400)
RESEARCH_LEADS = CachePolicy(ttl=7 * 86400, max_stale=30 * 86400)
PEER_DISCOVERY = CachePolicy(ttl=7 * 86400, max_stale=30 * 86400)
PEER_QUOTE = CachePolicy(ttl=900, max_stale=7 * 86400)
SIGNALS = CachePolicy(ttl=21600, max_stale=7 * 86400)
SOURCE_HEALTH_TTL = 300
UPSTREAM_RETRY_SECONDS = 900
SNAPSHOT_TIMEOUT_SECONDS = 40
FINANCIAL_MAX_STALE = 366 * 86400


def tracking_ttl(cadence: str | None) -> int:
    return 86400 if cadence == 'daily' else 7 * 86400 if cadence == 'weekly' else REFERENCE.ttl
