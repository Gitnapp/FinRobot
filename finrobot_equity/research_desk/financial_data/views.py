"""Projections of canonical metrics for existing domain cards, never provider parsing."""


def evidence_view(report):
    fields = report["fields"]
    sources = sorted({f["provider"] for f in fields.values() if f.get("status") == "reported"})
    urls = [f.get("source_url") for f in fields.values() if f.get("source_url")]
    return {
        "period": report["period"],
        "currency": report["currency"],
        "source": " / ".join(sources),
        "source_url": urls[0] if urls else None,
        "metrics": {k: f["value"] for k, f in fields.items()},
        "metric_sources": fields,
        "filings": [],
    }
