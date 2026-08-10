# Carleton Lodge No. 465 — Legacy Owned Image Archive

Images recovered from the Internet Archive's captures of the Lodge's retired website,
`carletonlodge465.com`, and preserved here permanently.

**Recovered:** 9 August 2026. **Files:** 89 (79 from the supplied manifest + 10 found by
an independent CDX sweep of the domain).

## Permission basis

The Lodge has confirmed that images originating from its own retired site are Lodge-owned
and may be reused on `carpmasons.ca`. That warrant covers the Lodge's own photographs and
site graphics. It does **not** cover the third-party organisational emblems that the legacy
site also carried (Scottish Rite, Shriners, York Rite, Eastern Star) — those are marked
`suitable_for_public_display = no` in the manifest.

## Layout

```
legacy-owned/
  originals/<category>/   89 files, byte-identical to the archived bytes. Never edit these.
  curated/<category>/     37 website-ready copies under descriptive filenames.
  image-manifest.csv      Full record, one row per recovered file.
  image-manifest.json     Same data as JSON.
  recovery-package/       The supplied recovery package plus the scripts used.
```

`originals/` is the preservation copy. Every file there is verified byte-identical to what
the Internet Archive served, with a SHA-256 recorded in the manifest. Do not modify, rename
or optimise anything under `originals/` — derive from `curated/` instead.

## Manifest fields

`original_filename`, `curated_filename`, `category`, `description`, `known_date`,
`known_people`, `source`, `original_url`, `wayback_recovery_url`,
`suitable_for_public_display`, `identification_research_required`, `original_path`,
`curated_path`, `bytes`, `sha256`.

## Before publishing anything

Descriptions record only what is **visibly shown**, or what is established by the legacy
filename or by EXIF metadata. No names, dates, events or identities have been inferred.
72 of the 89 files are flagged `identification_research_required = yes` — these need a
member of the Lodge to confirm who and what is pictured before any caption is written.

Two specific cautions:

- **`char-poster-2014.preview.jpg`** prints a named member's personal telephone number and
  personal email address. It is flagged not suitable for public display. Redact before any use.
- **56 of the 89 files are 100-pixel Drupal thumbnails.** The full-size originals were never
  captured by the Wayback crawler — this was verified against the CDX index, and 100px is all
  that survives for those. They are preserved as an historical record, not as usable web assets.

## Resolution reality

| Tier | Count | Notes |
|---|---|---|
| ≥600px | 23 | Genuinely usable on the site |
| 300–599px | 4 | Usable at small sizes |
| 101–299px | 6 | Mostly emblems and small portraits |
| ≤100px | 56 | Record only — no larger capture exists |

The single best image is
`originals/lodge-interior/dscn0037.jpg` (3595×2276) — a full Lodge room interior from
27 November 2014.

## Do not hotlink

Never link to `web.archive.org` from production. These local copies are the source of truth.
