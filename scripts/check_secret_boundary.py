"""Scan versionable project files for injected credential values; print paths only."""

import os
import subprocess
from pathlib import Path

secrets = [
    v
    for k, v in os.environ.items()
    if (k.endswith("_API_KEY") or k.endswith("_TOKEN")) and len(v) > 10
]
files = (
    subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"])
    .decode()
    .split("\0")
)
matches = []
for filename in files:
    file = Path(filename)
    if not file.is_file() or file.stat().st_size > 5_000_000:
        continue
    try:
        content = file.read_text()
    except (UnicodeError, OSError):
        continue
    if any(secret in content for secret in secrets):
        matches.append(filename)
print("Credential values checked:", len(secrets), "matches:", len(matches))
if matches:
    print("Files requiring cleanup:", matches)
    raise SystemExit(1)
