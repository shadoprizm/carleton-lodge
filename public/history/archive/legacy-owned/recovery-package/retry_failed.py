#!/usr/bin/env python3
"""Retry the failed rows from download-results.csv with backoff + CDX fallback.

Failures were ConnectionRefused (Wayback throttling), not missing captures, so the
main fix is pacing. Where a URL genuinely has no capture at the manifest timestamp,
we query the CDX index for any other archived capture of the same original URL.
"""
from pathlib import Path
import csv, hashlib, json, time, urllib.request, urllib.error

ROOT = Path(__file__).resolve().parent
RESULTS = ROOT / "download-results.csv"
OUT = ROOT / "recovered_images"
CDX = "https://web.archive.org/cdx/search/cdx?url={}&output=json&filter=statuscode:200&collapse=digest&limit=25"

HEADERS = {"User-Agent": "CarletonLodge465ArchiveRecovery/1.0"}


def fetch(url, timeout=90):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read(), resp.headers.get("Content-Type", "")


def fetch_with_backoff(url, attempts=6, base=5.0):
    last = None
    for i in range(attempts):
        try:
            return fetch(url)
        except Exception as exc:  # noqa: BLE001 - record and back off
            last = exc
            time.sleep(base * (2 ** i))
    raise last


def cdx_candidates(original_url):
    try:
        raw, _ = fetch_with_backoff(CDX.format(urllib.parse.quote(original_url, safe="")), attempts=4)
        data = json.loads(raw.decode("utf-8"))
    except Exception:
        return []
    if len(data) < 2:
        return []
    cols = data[0]
    ts_i, orig_i = cols.index("timestamp"), cols.index("original")
    return [f"https://web.archive.org/web/{r[ts_i]}id_/{r[orig_i]}" for r in data[1:]]


import urllib.parse  # noqa: E402

rows = list(csv.DictReader(RESULTS.open(encoding="utf-8-sig")))
todo = [r for r in rows if r["status"] != "downloaded" and r["status"] != "skipped_existing"]
print(f"Retrying {len(todo)} failed rows\n")

for idx, row in enumerate(todo, 1):
    dest = ROOT / row["local_path"]
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size:
        continue

    data = None
    used_url = row["wayback_download_url"]
    try:
        data, ctype = fetch_with_backoff(used_url)
    except Exception as exc:
        print(f"  [{idx:03d}] primary failed ({exc!r}) -> CDX fallback for {row['suggested_filename']}")
        for cand in cdx_candidates(row["original_url"]):
            try:
                data, ctype = fetch_with_backoff(cand, attempts=3)
                used_url = cand
                print(f"        recovered via {cand}")
                break
            except Exception:
                continue

    if data:
        dest.write_bytes(data)
        row["status"] = "downloaded"
        row["bytes"] = len(data)
        row["sha256"] = hashlib.sha256(data).hexdigest()
        row["error"] = ""
        row["wayback_download_url"] = used_url
        print(f"[{idx:03d}/{len(todo):03d}] downloaded       {dest.name} ({len(data)} bytes)")
    else:
        row["status"] = "failed"
        row["error"] = "no capture recoverable (primary + CDX exhausted)"
        print(f"[{idx:03d}/{len(todo):03d}] FAILED           {dest.name}")

    time.sleep(2.0)

with RESULTS.open("w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)

done = sum(1 for r in rows if r["status"] in ("downloaded", "skipped_existing"))
print(f"\nTotal downloaded: {done}/{len(rows)}")
