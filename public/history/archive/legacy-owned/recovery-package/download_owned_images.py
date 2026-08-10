#!/usr/bin/env python3
"""
Carleton Lodge No. 465 — Wayback image recovery downloader.

Run from an internet-connected computer:
    python download_owned_images.py

It reads owned-image-manifest.csv, retrieves the exact archived bytes from
the Internet Archive, stores them under recovered_images/<category>/,
and writes download-results.csv with SHA-256 hashes.

The files listed in this manifest came from the Lodge's retired
carletonlodge465.com site. The Lodge has confirmed these are Lodge-owned assets.
"""
from pathlib import Path
import csv, hashlib, time, urllib.request, urllib.error

ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "owned-image-manifest.csv"
OUT = ROOT / "recovered_images"
RESULTS = ROOT / "download-results.csv"

rows = list(csv.DictReader(MANIFEST.open(encoding="utf-8-sig")))
result_rows = []

headers = {"User-Agent": "CarletonLodge465ArchiveRecovery/1.0"}

for idx, row in enumerate(rows, 1):
    category = row["category"] or "uncategorized"
    dest_dir = OUT / category
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / row["suggested_filename"]
    url = row["wayback_download_url"]

    status = "skipped_existing" if dest.exists() and dest.stat().st_size else ""
    error = ""
    sha = ""
    size = dest.stat().st_size if status else 0

    if not status:
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
                content_type = resp.headers.get("Content-Type", "")
            if not data:
                raise RuntimeError("Empty response")
            dest.write_bytes(data)
            size = len(data)
            sha = hashlib.sha256(data).hexdigest()
            status = "downloaded"
        except Exception as exc:
            status = "failed"
            error = repr(exc)
    else:
        data = dest.read_bytes()
        sha = hashlib.sha256(data).hexdigest()

    result_rows.append({
        **row,
        "local_path": str(dest.relative_to(ROOT)),
        "status": status,
        "bytes": size,
        "sha256": sha,
        "error": error,
    })
    print(f"[{idx:03d}/{len(rows):03d}] {status:16s} {dest.name}")
    time.sleep(0.15)

fields = list(result_rows[0].keys()) if result_rows else []
with RESULTS.open("w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(result_rows)

print(f"\nFinished. Images: {OUT}")
print(f"Results: {RESULTS}")
