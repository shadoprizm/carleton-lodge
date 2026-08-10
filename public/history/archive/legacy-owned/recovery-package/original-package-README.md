# Carleton Lodge No. 465 — Owned Image Recovery

This package inventories **79 recoverable image assets** preserved from the retired `carletonlodge465.com` website.

The Lodge has confirmed that images recovered from its retired site are Lodge-owned and may be reused on `carpmasons.ca`.

## What is actually recoverable

The Internet Archive CDX index contains authentic archived image files from the Lodge's older Drupal-era site and later Joomla site. The inventory includes:

- an authentic photograph of the Lodge building;
- Lodge-room interior views (`the_north`, `the_south`, `the_west`, lights and Worshipful Master's station);
- Worshipful Master / member photographs;
- installation galleries;
- community/parade photographs;
- event photographs;
- legacy logos/site imagery;
- annual gallery cover images for 2016–2025 where archived.

The image bytes were independently tested against the Internet Archive; the archived Lodge-building JPEG returned HTTP 200 as `image/jpeg`.

## Downloading everything

On any internet-connected computer:

```bash
python download_owned_images.py
```

The script will create:

```text
recovered_images/
  building/
  community/
  event/
  gallery_cover/
  installation/
  interior/
  people/
  site_asset/
```

and a `download-results.csv` with each file's SHA-256 checksum.

## Why the actual JPEGs are not bundled here

This ChatGPT execution sandbox cannot directly transfer arbitrary binary responses from the Wayback Machine into its local filesystem. The manifest and downloader use the exact archived URLs, so K3 or your local development environment can retrieve them automatically in one run.

## K3 recommendation

After download, copy the curated images into the website project under a stable Lodge-controlled path such as:

`public/history/archive/legacy-owned/`

Do **not** hotlink to the Internet Archive in production.

## Review before publishing

Many legacy filenames do not contain good captions. Review the recovered photographs visually before assigning dates, names or historical descriptions. A photo being Lodge-owned does not by itself prove the date/identity of everyone pictured.
