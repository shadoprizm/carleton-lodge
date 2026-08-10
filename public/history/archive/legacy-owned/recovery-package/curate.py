#!/usr/bin/env python3
"""Curate the recovered Carleton Lodge image archive into the carpmasons.ca project.

Originals are copied byte-identical into originals/; a descriptive-name copy of each
useful image goes into curated/. Descriptions record only what is visibly shown or
established by filename/EXIF — nothing is inferred about names, dates or events.
"""
from pathlib import Path
import csv, hashlib, json, shutil

SRC = Path(__file__).resolve().parent
PROJ = Path("/Users/jratelle/Coding Projects/Carleton Lodge/project")
BASE = PROJ / "public/history/archive/legacy-owned"
ORIG = BASE / "originals"
CUR = BASE / "curated"

SOURCE_LABEL = "Archived Carleton Lodge No. 465 website"

# category slugs (user taxonomy)
BUILDING = "historical-lodge-building"
INTERIOR = "lodge-interior"
FURNITURE = "lodge-furniture-artifacts"
PEOPLE = "people-past-masters"
INSTALL = "installations"
MEETINGS = "lodge-meetings-visits"
COMMUNITY = "community-events"
PARADES = "parades"
REMEMBRANCE = "remembrance"
LOGOS = "logos-legacy-graphics"
UNKNOWN = "unknown-requires-identification"

# original_filename -> (category, curated_filename|None, description, known_date,
#                       known_people, public_ok, id_required)
C = {
 # ---- building ----
 "CarletonLodge465-building.jpg": (BUILDING, "carleton-lodge-building-winter-exterior.jpg",
   "Exterior of the Carleton Lodge building in winter: white clapboard gable-end structure with a "
   "pointed Gothic-arched window over the entrance, stone/painted lower course, snow on the ground.",
   "", "", True, False),
 "CarletonLodge465_building_spacevariant.jpg": (BUILDING, None,
   "Byte-identical duplicate of CarletonLodge465-building.jpg, archived under a space-separated "
   "filename variant. Retained for provenance only.", "", "", True, False),
 "CarletonDirections.jpg": (BUILDING, "carleton-lodge-directions-map.jpg",
   "Hand-drawn directions map to the Lodge at 3704 Carp Rd, showing Carp, Carp Road, March Road, "
   "Marsh Road, Kanata, Ottawa and Highway 417.", "", "", True, False),
 "lodge-picture-3-sepia.jpg": (BUILDING, "carleton-lodge-building-sepia.jpg",
   "Sepia-toned photograph of the Lodge building seen from the front corner, showing the Gothic-arched "
   "window, entrance steps and bare trees. Highest-resolution building image recovered (1282x1000).",
   "", "", True, False),
 "gallery-cover-2021.jpg": (BUILDING, "carleton-lodge-building-exterior-colour.jpg",
   "Colour exterior photograph of the Lodge building in leaf-on season, showing the full side "
   "elevation, Gothic-arched window and entrance.", "", "", True, False),

 # ---- interior + furniture ----
 "dscn0037.jpg": (INTERIOR, "lodge-room-interior-and-assembly-2014-11-27.jpg",
   "Full Lodge room interior at 3595x2276 — the highest-quality image recovered. Shows the black-and-white "
   "chequered mosaic pavement, three turned wooden columns on stepped plinths carrying brass candle lights, "
   "the panelled oak pedestal with red velvet cushion and open Volume of the Sacred Law surmounted by square "
   "and compasses, a red velvet kneeling bench with Gothic arcade carving, a model of Jacob's Ladder, and a "
   "large assembly of members and visiting dignitaries in Grand Lodge regalia. Framed portraits, the Lodge "
   "charter and wall plaques are visible behind.",
   "2014-11-27 (EXIF DateTimeOriginal)", "", True, True),
 "dscn0037.preview.jpg": (INTERIOR, None,
   "640x405 derivative of dscn0037.jpg. Superseded by the full-resolution original.",
   "2014-11-27 (EXIF DateTimeOriginal)", "", True, False),
 "the_desk_and_the_north.thumbnail.jpg": (INTERIOR, "lodge-room-the-north.jpg",
   "Lodge room, the North: two members in regalia at a desk/pedestal, framed pictures and a large framed "
   "item on the wall behind. 100px archived thumbnail — no larger capture exists.", "", "", True, True),
 "the_lights.thumbnail.jpg": (INTERIOR, "lodge-room-the-lesser-lights.jpg",
   "Lodge room showing the three turned wooden columns carrying the lesser lights, the pedestal with red "
   "cushion, and the chequered mosaic pavement. 100px archived thumbnail.", "", "", True, True),
 "the_south.thumbnail.jpg": (INTERIOR, "lodge-room-the-south.jpg",
   "Lodge room, the South: a member in regalia standing at a pedestal beside a tall staff/column, with a "
   "wall hanging behind. 100px archived thumbnail.", "", "", True, True),
 "the_west.thumbnail.jpg": (INTERIOR, "lodge-room-the-west.jpg",
   "Lodge room, the West: three members in regalia standing behind a wooden pedestal, framed pictures and a "
   "wall clock behind. 100px archived thumbnail.", "", "", True, True),
 "the_worshipful_master.thumbnail.jpg": (INTERIOR, "lodge-room-worshipful-masters-station.jpg",
   "Lodge room, the Worshipful Master's station: a member in Master's regalia standing before the blue "
   "hanging and framed items of the East. 100px archived thumbnail.", "", "", True, True),
 "gallery-cover-2022.jpg": (INTERIOR, "lodge-room-interior-with-members.jpg",
   "Lodge room interior with members assembled around the room in regalia, showing the chequered pavement, "
   "the pedestal, the columns and the letter G mounted on the far wall.", "", "", True, True),
 "gallery-cover-2017.jpg": (INTERIOR, "lodge-room-officers-and-visitors.jpg",
   "Group of officers and visiting dignitaries in Grand Lodge regalia standing in the Lodge room, with "
   "framed portraits, framed documents and the carved Master's chair visible behind.", "", "", True, True),

 # ---- remembrance ----
 "freedomisnotfree_mod.jpg": (REMEMBRANCE, "cornerstone-time-capsule-2016-05-28.jpg",
   "Close photograph of the engraved granite cornerstone, suspended on a lifting ring. Inscription reads: "
   "\"CARLETON LODGE No. 465 / A.F. & A.M. G.R.C. IN ON.\" above a square and compasses with G, then "
   "\"CEMENTING OUR BROTHERLY LOVE WITH THOSE FROM WEST CARLETON WHO DIED TO REMIND US 'FREEDOM IS NOT FREE' "
   "/ Cornerstone & Time Capsule Laid A.L. 6016 May 28 2016 A.D.\"",
   "2016-05-28 (from the inscription)", "", True, False),
 "gallery-cover-2016.jpg": (REMEMBRANCE, "cornerstone-time-capsule-2016-05-28-alt.jpg",
   "Alternate crop of the same engraved granite cornerstone and time capsule marker.",
   "2016-05-28 (from the inscription)", "", True, False),
 "gallery-cover-2023.jpg": (REMEMBRANCE, None,
   "Outdoor group of members in Grand Lodge regalia and winter coats assembled by a flagpole in front of a "
   "multi-storey building. Occasion, location and date are not established.", "", "", True, True),

 # ---- installations ----
 **{f"installation_{n}.thumbnail.jpg": (INSTALL, f"installation-ceremony-{n:02d}.jpg", desc, "", "", True, True)
    for n, desc in {
      1: "Installation ceremony: members assembled around the Lodge room behind the pedestal and columns, "
         "chequered pavement in the foreground. 100px archived thumbnail.",
      2: "Installation ceremony: members standing in regalia behind the pedestal with red covering, flanked "
         "by the columns. 100px archived thumbnail.",
      3: "Installation ceremony: a line of members in regalia holding framed presentations. 100px thumbnail.",
      4: "Installation ceremony: three members in Grand Lodge regalia holding framed presentations. 100px thumbnail.",
      5: "Installation ceremony: two members in regalia, one holding a framed presentation. 100px thumbnail.",
      7: "Installation ceremony: two members in light-blue collars holding framed presentations. 100px thumbnail.",
      8: "Installation ceremony: two members, one in regalia holding a framed presentation. 100px thumbnail.",
    }.items()},

 # ---- people ----
 "2014_wm_photo_small.jpg": (PEOPLE, "worshipful-master-2014.jpg",
   "Formal portrait of the Worshipful Master in Master's collar, jewel and apron against a plain backdrop.",
   "2014 (filename); EXIF DateTimeOriginal 2014-08-14",
   "Worshipful Master for 2014 — name not established by the archived material.", True, True),
 "wm_blog_small.jpg": (PEOPLE, "worshipful-master-in-chair.jpg",
   "Worshipful Master seated in the carved wooden Master's chair, in collar and jewel, with papers on the "
   "pedestal before him. The chair's carved crest and finials are clearly visible.",
   "EXIF DateTimeOriginal 2011-01-27", "Name not established by the archived material.", True, True),
 "rwbro_ray_grant.thumbnail.jpg": (PEOPLE, "rw-bro-ray-grant.jpg",
   "A member in Grand Lodge regalia standing in the Lodge room holding a case or presentation. 100px "
   "archived thumbnail.", "",
   "Filename identifies the subject as RW Bro Ray Grant; the identification comes from the legacy filename "
   "and has not been independently confirmed.", True, True),
 "dscn1896.thumbnail.jpg": (PEOPLE, None,
   "Two members in regalia side by side, one wearing a Grand Lodge collar with jewels. 100px thumbnail.",
   "", "", True, True),
 "dscn1898-sm.jpg": (PEOPLE, "member-with-gavel.jpg",
   "A member in Master's collar and jewel holding a gavel, photographed against a light wall.",
   "EXIF DateTimeOriginal 2013-06-27", "Name not established.", True, True),

 # ---- meetings and visits ----
 "img_0067m.jpg": (MEETINGS, "lodge-assembly-panorama-2014-10-25.jpg",
   "Wide panoramic group photograph (1794x768) of members and visiting dignitaries in Grand Lodge regalia "
   "assembled in the Lodge room. The framed Lodge charter/warrant and a bronze memorial plaque are visible "
   "on the wall behind.", "2014-10-25 (EXIF DateTimeOriginal)", "", True, True),
 "img_0067m.preview.jpg": (MEETINGS, None,
   "640x274 derivative of img_0067m.jpg. Superseded by the full-resolution original.",
   "2014-10-25 (EXIF DateTimeOriginal)", "", True, False),
 "visiting_from_the_valley.thumbnail.jpg": (MEETINGS, "visiting-brethren-from-the-valley.jpg",
   "Several visitors seated in the Lodge room wearing wide-brimmed hats and regalia. Filename indicates a "
   "visitation described on the legacy site as \"visiting from the valley\". 100px thumbnail.", "", "", True, True),
 "cb_ba_pt_st.thumbnail.jpg": (MEETINGS, None,
   "Officers seated in the Lodge room in regalia beside the panelled woodwork. Filename is an unexplained "
   "abbreviation. 100px thumbnail.", "", "", True, True),
 "gallery-cover-2025.jpg": (MEETINGS, None,
   "Group of members and guests, some in Highland dress, standing behind a draped table in a red-curtained "
   "room. Venue and occasion are not established.", "", "", True, True),
 **{f"dscn{n}.thumbnail.jpg": (MEETINGS, None,
    "Members assembled in regalia in the Lodge room. 100px archived thumbnail; detail is limited.",
    "", "", True, True) for n in ["0040", "0041", "1887", "1890", "1891", "1893"]},

 # ---- community events ----
 "arctic_char_signage_2014.preview.jpg": (COMMUNITY, "arctic-char-dinner-roadside-sign-2014.jpg",
   "Roadside letter-board sign advertising \"ARCTIC CHAR DINNER & DANCE — $35 TICKETS — MAY 2\", with a "
   "Carleton Masonic Lodge sign mounted beside it.",
   "2014-05-02 event; EXIF DateTimeOriginal 2014-04-29", "", True, False),
 "char-poster-2014.preview.jpg": (COMMUNITY, None,
   "Printed promotional poster for the Carleton Masonic Lodge Arctic Char Dinner & Dance, Friday 2 May 2014 "
   "at the Carp Agricultural Hall, 3790 Carp Rd. NOT SUITABLE FOR PUBLICATION AS-IS: the poster prints a "
   "named member's personal telephone number and personal email address. Redact before any public use.",
   "2014-05-02 (printed on the poster)", "Poster names a member as ticket contact (personal contact details "
   "shown).", False, False),
 "smilebox_2360079861.jpg": (PARADES, "santa-parade-float-carleton-lodge.jpg",
   "Carleton Lodge parade float on a snowy road: a red-canopied flatbed trailer with a decorated Christmas "
   "tree, candy canes, tinsel and a Santa figure, carrying riders in winter clothing. The banner reads "
   "\"CARLETON MASONIC LODGE No. 465 Carp Ont — www.CarletonLodge465.com — 2B1-ASK1\" beside a maple-leaf "
   "square-and-compasses emblem.", "", "", True, True),
 "smilebox_2360079861.preview.jpg": (PARADES, None,
   "640x426 derivative of smilebox_2360079861.jpg. Superseded by the larger original.", "", "", True, False),
 **{f"wc_parade-{s}.thumbnail.jpg": (PARADES, f"west-carleton-parade-{i:02d}.jpg", desc, "", "", True, True)
    for i, (s, desc) in enumerate([
      ("1b", "Parade float decorated with garlands and figures, carrying riders in Santa hats, with a banner "
             "along the side. 100px archived thumbnail."),
      ("2",  "Parade float towed by a pickup truck along a snowy street, with spectators on the roadside. "
             "100px archived thumbnail."),
      ("3",  "Riders on the float in Santa hats and winter clothing waving to the crowd. 100px thumbnail."),
      ("4",  "Float seen from the side with the Lodge banner legible along the trailer. 100px thumbnail."),
      ("5",  "Decorated float with Santa and Mrs Claus figures and children aboard. 100px thumbnail."),
      ("6",  "Two men in winter coats standing beside the float and tow vehicle before the parade. 100px thumbnail."),
    ], 1)},

 # ---- banquet / dinner sequence (img_57xx) ----
 **{f"img_{n}.thumbnail.jpg": (COMMUNITY, None, desc, "", "", True, True)
    for n, desc in {
      "5692": "Indoor evening function: a lectern and lamp in a darkened hall. 100px thumbnail.",
      "5693": "Indoor evening function: a table with a lamp and dark surroundings. 100px thumbnail.",
      "5695": "Banquet hall with rows of chairs and tables set for a function, people standing at the back. "
              "100px thumbnail.",
      "5698": "Corner of a function room with lighting stand and doorway. 100px thumbnail.",
      "5700": "Banquet table detail: a lit candle in a glass holder, printed menu or programme cards and "
              "table settings. 100px thumbnail.",
      "5700_0": "Duplicate capture of the banquet table detail with candle and printed cards. 100px thumbnail.",
      "5705": "Three men in formal dress standing and talking at the function, one holding a microphone. "
              "100px thumbnail.",
      "5706": "Two men in formal dress reading from a document at the function. 100px thumbnail.",
      "5713": "A man in a suit standing beside a screen or display at the function. 100px thumbnail.",
      "5715": "A man in formal dress standing at the front of the room. 100px thumbnail.",
      "5716": "Three men in formal dress at the function, one holding a long object presented between them. "
              "100px thumbnail.",
      "5720": "A man in a suit speaking at the function. 100px thumbnail.",
      "5723": "Two men shaking hands at the function, one in formal dress. 100px thumbnail.",
      "5728": "A young man in formal dress standing at the front of the room. 100px thumbnail.",
      "5729": "A man in light-coloured shirt standing at a lectern. 100px thumbnail.",
      "5733": "Two men in formal dress posed together for the camera. 100px thumbnail.",
      "5734": "Two men in formal dress posed together for the camera. 100px thumbnail.",
      "5736": "A group of young people in matching dark sweatshirts posed together in front of a banner. "
              "100px thumbnail.",
    }.items()},

 # ---- social / celebration sequence (p6260xxx) ----
 "p6260009.thumbnail.jpg": (COMMUNITY, None,
   "A decorated sheet cake iced with \"Congratulations Carleton Lodge\" above a maple-leaf square-and-"
   "compasses emblem, with a two-part year range iced beneath. The year range is NOT legible at the only "
   "archived resolution (100x56) and must not be quoted without confirmation.",
   "", "", True, True),
 **{f"p6260{n}.thumbnail.jpg": (COMMUNITY, None, desc, "", "", True, True)
    for n, desc in {
      "008_0": "Members and guests seated at tables in a hall during a social function. 100px thumbnail.",
      "010": "Two men in conversation at a table during the function. 100px thumbnail.",
      "011": "Men seated at a table during the function. 100px thumbnail.",
      "012": "Guests standing and talking during the function. 100px thumbnail.",
      "013": "A man in formal dress seated beside another guest at the function. 100px thumbnail.",
      "014": "A man in formal dress standing and talking with seated guests. 100px thumbnail.",
      "016": "Guests seated along a table at the function. 100px thumbnail.",
      "018": "Guests in conversation during the function. 100px thumbnail.",
      "020": "A buffet table laid with platters of food at the function. 100px thumbnail.",
    }.items()},

 # ---- logos / legacy graphics ----
 "carleton-lodge-logo.png": (LOGOS, "carleton-masonic-lodge-logo.png",
   "Legacy site wordmark: \"Carleton Masonic Lodge, No. 465 A.F. & A.M., Grand Lodge of Canada in the "
   "Province of Ontario — Instituted January 12, 1904\", with a maple leaf at left and a pillared Masonic "
   "device at right. Largest and cleanest logo recovered (1158x262, PNG).", "", "", True, False),
 "Lodge-Logo.jpg": (LOGOS, "carleton-masonic-lodge-logo-banner.jpg",
   "Legacy site banner logo: \"Carleton Masonic Lodge, No. 465 A.F. & A.M., Grand Lodge of Canada in the "
   "Province of Ontario\" with a pillared Masonic device at left.", "", "", True, False),
 "headerstrip.jpg": (LOGOS, None,
   "Legacy site header strip: a narrow letterboxed crop of a group photograph of members in regalia in the "
   "Lodge room, used as a decorative page banner.", "", "", True, False),
 "background_headerstrip.jpg": (LOGOS, None,
   "Legacy site header background: a heavily blurred and stretched 2560x188 crop of a group photograph, "
   "used as a decorative backdrop. No usable detail.", "", "", True, False),
 "gallery-cover-2018.jpg": (LOGOS, None,
   "Plain black-on-white square and compasses with the letter G. A generic Masonic device, not specific to "
   "Carleton Lodge.", "", "", True, False),
 "gallery-cover-2019.jpg": (UNKNOWN, None,
   "Close texture photograph of a coursed rubble stone wall. Used as a gallery cover image; the wall is not "
   "identified and may not be a Lodge property.", "", "", True, True),

 # ---- third-party emblems (NOT Lodge-owned) ----
 **{n: (LOGOS, None, desc, "", "", False, True) for n, desc in {
      "EagleGoldTrans190.gif": "Double-headed eagle emblem with the motto \"DEUS MEUMQUE JUS\" — the device "
        "of the Ancient and Accepted Scottish Rite. THIRD-PARTY EMBLEM: this is the mark of another Masonic "
        "body, not a Carleton Lodge asset. The Lodge's ownership warrant does not extend to it.",
      "Leaf_SC_200W.gif": "Red maple leaf charged with a square and compasses and the letter G. Generic "
        "Canadian Masonic device carried on the legacy site; origin and rights not established.",
      "Shriners_0.png": "Scimitar, crescent and sphinx-head emblem of the Shriners. THIRD-PARTY EMBLEM: the "
        "mark of another organisation, not a Carleton Lodge asset.",
      "York_Rite.gif": "Composite roundel of the York Rite bodies. THIRD-PARTY EMBLEM: the mark of another "
        "Masonic body, not a Carleton Lodge asset.",
      "gcStar.gif": "Five-pointed star emblem of the Order of the Eastern Star. THIRD-PARTY EMBLEM: the mark "
        "of another organisation, not a Carleton Lodge asset.",
    }.items()},
}


def main():
    ORIG.mkdir(parents=True, exist_ok=True)
    CUR.mkdir(parents=True, exist_ok=True)

    # provenance lookup: filename -> (original_url, wayback_url)
    prov = {}
    for row in csv.DictReader((SRC / "download-results.csv").open(encoding="utf-8-sig")):
        prov[row["suggested_filename"]] = (row["original_url"], row["wayback_download_url"])
    for row in csv.DictReader((SRC / "extra-downloads.csv").open(encoding="utf-8-sig")):
        prov[row["filename"]] = (row["original_url"], row["wayback_download_url"])

    records, missing = [], []
    for base in ("recovered_images", "recovered_extra"):
        for p in sorted((SRC / base).rglob("*.*")):
            if not p.is_file():
                continue
            meta = C.get(p.name)
            if not meta:
                missing.append(p.name)
                continue
            cat, curated, desc, date, people, public_ok, id_req = meta

            dest = ORIG / cat / p.name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, dest)

            cur_rel = ""
            if curated:
                cdest = CUR / cat / curated
                cdest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(p, cdest)
                cur_rel = str(cdest.relative_to(PROJ / "public"))

            data = p.read_bytes()
            orig_url, wb_url = prov.get(p.name, ("", ""))
            records.append({
                "original_filename": p.name,
                "curated_filename": curated or "",
                "category": cat,
                "description": desc,
                "known_date": date,
                "known_people": people,
                "source": SOURCE_LABEL,
                "original_url": orig_url,
                "wayback_recovery_url": wb_url,
                "suitable_for_public_display": "yes" if public_ok else "no",
                "identification_research_required": "yes" if id_req else "no",
                "original_path": str(dest.relative_to(PROJ / "public")),
                "curated_path": cur_rel,
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            })

    if missing:
        raise SystemExit(f"Uncurated files present: {missing}")

    records.sort(key=lambda r: (r["category"], r["original_filename"]))
    fields = list(records[0].keys())
    with (BASE / "image-manifest.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(records)
    (BASE / "image-manifest.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")

    from collections import Counter
    print(f"records: {len(records)}")
    print(f"curated: {sum(1 for r in records if r['curated_filename'])}")
    print(f"public-ok: {sum(1 for r in records if r['suitable_for_public_display']=='yes')}")
    print(f"needs-id: {sum(1 for r in records if r['identification_research_required']=='yes')}")
    for c, n in sorted(Counter(r["category"] for r in records).items()):
        print(f"  {c:38s} {n}")


if __name__ == "__main__":
    main()
