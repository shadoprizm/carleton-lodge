# Carleton Lodge No. 465 — History Integration Handoff

Prepared for integration into **carpmasons.ca**.

## Core product decision

The history archive is **not** the central purpose or dominant visual identity of carpmasons.ca.

Carpmasons.ca remains a current, useful Lodge website first: current Lodge information, meetings/events, officers, membership information, contact/help, community activity, and other existing functions remain primary.

History is a rich secondary branch reached intentionally through the existing **History** navigation item.

Recommended hierarchy:

- `/` — current Lodge website
- `/history` — historical landing page
  - `/history/founding`
  - `/history/fire-and-displacement`
  - `/history/temple`
  - `/history/le-havre`
  - `/history/war-and-remembrance`
  - `/history/people`
  - `/history/gallery`
  - `/history/sources`

Do not turn the homepage into a historical museum homepage.

## Package contents

- `K3_MASTER_PROMPT.md` — master implementation prompt for Kimi K3
- `HISTORY_CONTENT.md` — source-grounded copy and narrative material
- `history-data.json` — structured historical events for data-driven rendering
- `HISTORY_INFORMATION_ARCHITECTURE.md` — route and UX recommendations
- `source-register.csv` — source provenance and confidence register
- `image-acquisition-register.csv` — authentic-image acquisition list
- `OPEN_RESEARCH_QUESTIONS.md` — unresolved items that must not be presented as settled fact
- `IMAGE_POLICY.md` — authentic-photo / artifact-photo / AI-reconstruction rules

## Important source hierarchy

Prefer evidence in this order:

1. Grand Lodge Proceedings / Lodge records / original archival records
2. Library and Archives Canada / Veterans Affairs Canada / municipal or institutional archives
3. Huntley Township Historical Society / Carp Heritage Walk with explicit provenance
4. Ottawa District histories and lodge histories
5. Contemporary newspapers
6. Secondary historical writing
7. Oral tradition / current lodge website
8. AI-generated reconstruction — visual only, never evidence

## Critical corrections from the current site

- Dispensation to form Carleton Lodge: **24 October 1903**
- Instituted: **12 January 1904**
- Warrant No. 465 signed/dated: **20 July 1904**
- Consecrated: **4 October 1904**
- Original Lodge room: upstairs in the Kidd Block over the Carp Drug Store
- Kidd Block destroyed by fire: **20 July 1920**
- Temporary accommodations included the Orange Lodge hall and, by May 1923, the upper portion of Bro. F. C. Russell's store
- The former Presbyterian church was transferred to the Freemasons for **$250 plus legal transfer fees**; exact legal transfer date remains unresolved
- First meeting in the present Masonic Temple: **15 April 1927**
- Temple dedicated by Grand Lodge: **18 October 1930**
- Formal centennial celebration documented: **24 September 2005**

## Image handling

This package intentionally contains **no third-party historical image files** whose reuse rights have not been confirmed.

The image register tells you where to obtain them, how to credit them, and whether permission is required.

Development placeholders must be visually labelled as placeholders and must never be presented as authentic historical photographs.
