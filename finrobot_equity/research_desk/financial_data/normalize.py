"""Period, unit and provenance normalization; no network calls."""

import math
from datetime import date

from .registry import DERIVED, METRICS


def number(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def metric(
    value, provider, concept, url, period, currency, unit="currency", filed=None, start=None
):
    return {
        "value": number(value),
        "unit": currency if unit == "currency" else unit,
        "period": period,
        "period_start": start,
        "provider": provider,
        "concept": concept,
        "source_url": url,
        "filed": filed,
        "status": "reported",
    }


def sec_reports(facts):
    reports = {}
    fiscal_years = {}
    root = facts.get("facts", {})
    cik = str(facts.get("cik", 0))
    for key, spec in METRICS.items():
        for priority, alias in enumerate(spec.sec):
            namespace, tag = alias.split(":", 1) if ":" in alias else ("us-gaap", alias)
            for unit, entries in root.get(namespace, {}).get(tag, {}).get("units", {}).items():
                if (spec.unit == "shares" and unit != "shares") or (
                    spec.unit == "currency" and (len(unit) != 3 or not unit.isalpha())
                ):
                    continue
                for entry in entries:
                    if entry.get("form") not in (
                        "10-K",
                        "10-K/A",
                        "20-F",
                        "20-F/A",
                        "40-F",
                        "40-F/A",
                    ):
                        continue
                    end = entry.get("end")
                    start = entry.get("start")
                    if not end or number(entry.get("val")) is None:
                        continue
                    if not spec.instant:
                        if (
                            not start
                            or not 330
                            <= (date.fromisoformat(end) - date.fromisoformat(start)).days
                            <= 400
                        ):
                            continue
                    elif start:
                        continue
                    currency = unit if spec.unit == "currency" else None
                    fiscal_key = (end, start, currency)
                    if key == "revenue" and isinstance(entry.get("fy"), int):
                        filing = (entry.get("filed", ""), entry["fy"])
                        if (
                            fiscal_key not in fiscal_years
                            or filing[0] < fiscal_years[fiscal_key][0]
                        ):
                            fiscal_years[fiscal_key] = filing
                    group = reports.setdefault(
                        (end, start if not spec.instant else None, currency), {}
                    )
                    existing = group.get(key)
                    rank = (entry.get("filed", ""), -priority)
                    if existing and existing["_rank"] >= rank:
                        continue
                    accn = entry.get("accn", "")
                    url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accn.replace('-', '')}/{accn}-index.html"
                    value = abs(entry["val"]) if key == "capex" else entry["val"]
                    group[key] = {
                        **metric(
                            value,
                            "SEC EDGAR",
                            f"{namespace}:{tag}",
                            url,
                            end,
                            currency,
                            spec.unit,
                            entry.get("filed"),
                            start,
                        ),
                        "_rank": rank,
                    }
    result = []
    for (end, start, currency), fields in reports.items():
        if not start or not currency or "revenue" not in fields:
            continue
        combined = {
            **fields,
            **reports.get((end, None, currency), {}),
            **reports.get((end, start, None), {}),
        }
        for field in combined.values():
            field.pop("_rank", None)
        result.append(
            {
                "period": end,
                "start": start,
                "currency": currency,
                "year": fiscal_years.get((end, start, currency), (None, int(end[:4])))[1],
                "fields": combined,
            }
        )
    return sorted(result, key=lambda r: r["period"], reverse=True)


def derive(report, prior=None):
    fields = report["fields"]
    for key, (dependencies, calculate) in DERIVED.items():
        if fields.get(key, {}).get("value") is not None:
            continue
        values = [fields.get(k, {}).get("value") for k in dependencies]
        if any(v is None for v in values):
            continue
        value = calculate(*values)
        if value is None:
            continue
        fields[key] = {
            **metric(
                value,
                "calculated",
                key,
                None,
                report["period"],
                report["currency"],
                METRICS[key].unit,
                start=report["start"],
            ),
            "status": "derived",
            "inputs": list(dependencies),
            "sources": [fields[k] for k in dependencies],
        }
    if prior and prior["currency"] == report["currency"]:
        previous = prior["fields"].get("revenue", {}).get("value")
        current = fields.get("revenue", {}).get("value")
        if previous and previous > 0 and current is not None:
            fields["revenue_growth"] = {
                **metric(
                    current / previous - 1,
                    "calculated",
                    "revenue_growth",
                    None,
                    report["period"],
                    report["currency"],
                    "ratio",
                ),
                "status": "derived",
                "sources": [fields["revenue"], prior["fields"]["revenue"]],
            }
    for key, spec in METRICS.items():
        fields.setdefault(
            key,
            {
                "value": None,
                "unit": report["currency"] if spec.unit == "currency" else spec.unit,
                "period": report["period"],
                "status": "missing",
                "reason": "no_matching_fact",
            },
        )
    return report
