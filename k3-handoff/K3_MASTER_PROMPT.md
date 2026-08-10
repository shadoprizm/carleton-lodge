# MASTER PROMPT FOR KIMI K3

You are integrating a substantially expanded, source-grounded history section into the existing **carpmasons.ca** website for Carleton Lodge No. 465, Carp, Ontario.

## FIRST: inspect the existing codebase

Before changing anything:

1. Inspect the current framework, routing, components, styles, content model, image handling, SEO metadata, search implementation, and navigation.
2. Preserve the current site's design language and all current primary functionality.
3. Reuse existing components and patterns wherever reasonable.
4. Do not rewrite the whole site and do not replace the current information architecture simply because the history content is extensive.
5. Do not invent historical facts, dates, names, photographs, citations, or image rights.

## NON-NEGOTIABLE PRODUCT RULE

**The history section is a secondary branch of carpmasons.ca, not the central identity of the website.**

The main site must remain a contemporary Lodge website first.

The global navigation may continue to contain a normal `History` link, with the same visual weight as peer navigation items. Do not make History the default landing experience, do not redesign the homepage around the past, and do not flood the homepage with timelines, archival imagery, or museum-style navigation.

At most, the homepage may contain the same restrained History teaser/card that would be appropriate for any other site section.

All deep historical content belongs beneath `/history`.

## GOAL

Create a polished historical archive that feels like a small digital exhibit **when a visitor chooses to enter History**, while allowing the rest of carpmasons.ca to remain focused on current Lodge life.

The history experience should be:
- credible
- readable
- source-grounded
- visually rich when authentic images are available
- accessible
- mobile-friendly
- data-driven
- easy to expand later
- clear about uncertainty
- explicit when imagery is reconstructed rather than historical

## RECOMMENDED ROUTES

Use the current route structure if it can support the following cleanly. If changing existing history URLs, add redirects so old links do not break.

Recommended contained branch:

- `/history` — concise landing/timeline hub
- `/history/founding` — 1903–1920: formation, George N. Kidd, charter members, Kidd Block
- `/history/fire-and-displacement` — 1920–1926: fire, Orange Hall, Memorial Hall effort, Russell store
- `/history/temple` — former St. Andrew's Presbyterian Church, transfer, raising the building, 1927 first meeting, 1930 dedication
- `/history/le-havre` — La Loge Le Havre de Grâce No. 4 and the furniture/document journey
- `/history/war-and-remembrance` — WWI service, memorial tablet, Calvin Wilson, 2016 West Carleton War Memorial connection
- `/history/people` — founders, Past Masters, DDGMs, distinguished brethren
- `/history/gallery` — authentic historical photographs and modern photographs of historical artifacts
- `/history/sources` — readable source notes / acknowledgements

You may merge routes if the current architecture benefits from fewer pages, but keep all historical material under `/history`.

## DATA MODEL

Do not hard-code the history into large page components.

Create or adapt a structured content model for:
- historical events
- people
- places/buildings
- artifacts
- images
- sources

Every historical fact that is likely to be questioned should support:
- source ID(s)
- confidence level: `high`, `medium`, `unresolved`
- notes
- optional date precision: exact / month / year / circa / range

Every image should support:
- title
- date or circa date
- subject
- source institution/owner
- credit line
- source identifier
- rights status
- local asset path when acquired
- image type: `historical_photo`, `modern_artifact_photo`, `document_scan`, `map`, `ai_reconstruction`
- caption
- alt text

Use `history-data.json` and the supplied CSV registers as seed material. Adapt to the existing site's preferred content format if needed.

## CRITICAL HISTORICAL FACTS TO USE

Treat the following as high-confidence unless otherwise marked in the supplied source register:

- Dispensation to form Carleton Lodge at Carp: 24 October 1903.
- Petition supported by Mississippi Lodge No. 147, Almonte.
- Carleton Lodge instituted: 12 January 1904.
- 23 charter members.
- Warrant No. 465 signed/dated: 20 July 1904.
- Lodge consecrated: 4 October 1904 by R.W. Bro. Sidney Albert Luke.
- Original Lodge rooms were over the drug store in the Kidd Block.
- The Kidd Block fire occurred 20 July 1920.
- The fire apparently began in Joe Rishaur's tin shop and spread through the Kidd Block.
- Orange Lodge in Carp offered its hall as a temporary home.
- By May 1921, a stock company attempted to finance a memorial hall with a Lodge room on an upper floor; enough money was raised for a single-storey hall but not the proposed second-storey Lodge facility.
- By May 1923 Carleton Lodge was temporarily housed in the upper portion of Bro. F. C. Russell's store.
- Following the 1925 church union, members of Carleton Lodge approached the former Presbyterian congregation.
- The congregation agreed to deed the church building and land to the Freemasons for $250 plus legal transfer fees.
- The former church was refurbished and physically raised to provide a basement refreshment facility.
- Bro. William Stuart offered on 26 February 1926 to pay expenses to acquire the historic Le Havre furniture stored in London.
- First meeting in the present Masonic Temple: 15 April 1927.
- La Loge Le Havre de Grâce No. 4 was consecrated at Le Havre on 31 October 1916 and closed 7 January 1919.
- It had 71 founding members and 49 affiliates and conducted extensive degree work during its short wartime existence.
- Bro. Stuart arranged for the furniture and documents to be packed into sixteen crates and shipped to London aboard the `Perseverence`.
- After storage fees went unpaid and an auction was threatened, Carleton Lodge acquired the furniture and documents with clear title.
- The Le Havre collection did not include an altar; Carleton Lodge obtained an altar from A. F. Campbell & Son, Arnprior.
- Carleton Lodge possesses a historic setting maul associated with Captain Firebrace, first Master of La Loge Le Havre de Grâce.
- Grand Lodge formally dedicated the Carp Masonic Temple on 18 October 1930.
- A WWI memorial tablet was unveiled in Carleton Lodge on 19 May 1919 by Lt.-Gen. Sir Sam Hughes.
- Formal centennial celebration documented: 24 September 2005.

## FACTS THAT MUST NOT BE OVERSTATED

- Do not say the church was definitively “purchased in 1925” unless a deed or primary property record is later supplied.
  - Current evidence establishes the church-union context in 1925, a transfer agreement for $250 plus fees, renovation, and occupancy by 15 April 1927.
- Do not use `1929` as the acquisition date merely because a local-history summary says so; this conflicts with documented Lodge occupancy in 1927.
- Use **1876** for the construction of St. Andrew's only with a source note; keep the earlier 1872–1875 claim out unless independently proven.
- Do not claim a full list of 23 charter members unless all 23 names are sourced.
- Preserve `apparently` when describing the stated origin of the 1920 fire unless a contemporary fire report/newspaper source proves it.
- Do not present AI-generated images as documentary evidence.

## HISTORY LANDING PAGE

The `/history` page should be an elegant entry point, not an encyclopedia dump.

Recommended structure:
1. Short hero: “More than a century in Carp”
2. 2–3 paragraph overview
3. compact visual timeline
4. story cards for the major chapters
5. authentic-photo strip only when rights-cleared assets exist
6. “Explore the archive” links
7. acknowledgements / source link

Keep this page inviting and concise; detailed material belongs on child pages.

## VISUAL TREATMENT

Inside the History branch:
- use restrained archival cues, not a fake parchment theme
- keep typography consistent with the rest of carpmasons.ca
- authentic photographs should dominate when available
- allow image zoom/lightbox with full caption and credit
- support then-and-now comparisons
- use maps only where they improve geographic understanding
- use timelines sparingly
- preserve white space and readability

Outside the History branch:
- do not propagate the archival visual language across the rest of the site.

## IMAGE POLICY

Priority:
1. authentic historical photograph
2. authentic scan of map/document/newspaper
3. modern photograph of surviving building or artifact
4. clearly labelled AI reconstruction only when no authentic image exists

AI reconstruction label must be visible near the image:
`Historical reconstruction — AI-generated from documented sources; not an original photograph.`

Never use an AI reconstruction in a gallery filter called “Historical photographs”.

## INITIAL IMAGE PLACEHOLDERS / ACQUISITION

Do not copy third-party archive images into production unless rights are confirmed.

Create asset slots for:
- Kidd Block, circa 1910 — Huntley Township Historical Society
- Kidd Street, circa 1910 — HTHS
- St. Andrew's Presbyterian Church, Carp, 1876–1929 — Library and Archives Canada identifier C-12167
- Carp Village, Autumn 1890 — LAC Robert F.H. Bruce collection identifier PA-122498
- Orange Hall / Town Hall streetscape, circa 1900 — HTHS / Carp Heritage Walk provenance
- Carp Review / drug store / related Kidd Block streetscape images — HTHS / Carp Heritage Walk
- authentic Lodge and district photographs from Ottawa District histories
- modern high-resolution photographs to be taken of Le Havre furniture, setting maul, memorial tablet, Calvin Wilson plaque, stained glass, warrant, Past Masters boards, and other artifacts

When an asset is not yet cleared:
- use a neutral placeholder
- retain its metadata and desired caption
- do not display a misleading generated substitute automatically

## CITATIONS / SOURCES UX

Do not clutter every paragraph with academic footnote noise.

Instead:
- support subtle source markers on important claims
- show source details in an expandable “Sources & notes” area per page
- maintain `/history/sources`
- include image credit directly under every historical image
- preserve the underlying source IDs in the data model

## SEO

Keep main-site SEO intact.

For History:
- unique title/meta description per page
- canonical URLs
- structured breadcrumbs
- descriptive image alt text
- OpenGraph images only from rights-cleared assets
- redirects from any replaced existing history URLs

## ACCESSIBILITY / PERFORMANCE

- keyboard-accessible galleries and lightboxes
- meaningful alt text
- reduced-motion support
- lazy-load historical galleries
- responsive image sizing
- do not load the entire history asset archive on the homepage
- ensure history routes do not degrade the performance of the rest of the site

## DELIVERABLE

Implement the history branch in the existing project and leave the rest of the site substantially intact.

Before finishing:
1. verify all routes
2. verify no existing primary page is lost
3. verify old history URLs redirect if changed
4. verify mobile rendering
5. verify image credits and labels
6. verify no unresolved fact is presented as certain
7. verify AI reconstructions, if any, are unmistakably labelled
8. summarize files changed and any assets still awaiting permission/acquisition

Do not invent missing assets. Use the supplied acquisition register.
