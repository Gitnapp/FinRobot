"""Release availability is distinct from a numerical actual value."""

import math
from datetime import datetime, timezone


def actual_value(value, at, *, confirmed=False):
    if datetime.fromisoformat(at) > datetime.now(timezone.utc):
        return None, "scheduled"
    try:
        number = float(value) if value is not None and not isinstance(value, bool) else None
    except (TypeError, ValueError):
        number = None
    if number is None or not math.isfinite(number):
        return None, "unavailable"
    # JBlanked has no published-value flag. An unconfirmed zero is ambiguous,
    # not proof of either a release or a missing value. Confirmed zeros remain valid.
    if number == 0 and not confirmed:
        return None, "unverified"
    return number, "reported"
