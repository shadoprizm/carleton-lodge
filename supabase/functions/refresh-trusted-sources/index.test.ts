import { assertEquals, assertMatch } from "jsr:@std/assert@1.0.14";
import {
  calendarOccurrenceKey,
  compactCalendarSource,
  htmlToKnowledgeText,
  parseDistrictCalendar,
  trustedUrlIsAllowed,
} from "./index.ts";

Deno.test("calendar occurrence keys reconcile all-day events", () => {
  const occurrence = {
    external_uid: "district-all-day@example.test",
    event_date: "2026-09-12",
    event_time: null,
  };
  assertEquals(
    calendarOccurrenceKey(occurrence),
    calendarOccurrenceKey({ ...occurrence }),
  );
  assertEquals(
    calendarOccurrenceKey(occurrence) ===
      calendarOccurrenceKey({ ...occurrence, event_time: "19:30:00" }),
    false,
  );
});

Deno.test("trusted source URLs require an approved public HTTPS domain", () => {
  const domains = new Set(["ontariomasons.ca", "ottawamasons.ca"]);
  assertEquals(
    trustedUrlIsAllowed("https://ontariomasons.ca/our-districts/", domains),
    true,
  );
  assertEquals(
    trustedUrlIsAllowed("https://www.ottawamasons.ca/directory/", domains),
    true,
  );
  assertEquals(trustedUrlIsAllowed("http://ontariomasons.ca/", domains), false);
  assertEquals(
    trustedUrlIsAllowed("https://127.0.0.1/private", domains),
    false,
  );
  assertEquals(trustedUrlIsAllowed("https://example.com/", domains), false);
});

Deno.test("HTML cleaning removes scripts and keeps readable source text", () => {
  const text = htmlToKnowledgeText(`
    <html><head><script>ignore me</script><title>District</title></head>
    <body><h1>Ottawa District 2</h1><p>Upcoming lodge events &amp; meetings.</p></body></html>
  `);
  assertMatch(text, /Ottawa District 2/);
  assertMatch(text, /events & meetings/);
  assertEquals(text.includes("ignore me"), false);
});

Deno.test("calendar parsing normalizes official future events and degree work", () => {
  const future = new Date();
  future.setUTCMonth(future.getUTCMonth() + 1);
  future.setUTCDate(15);
  const year = String(future.getUTCFullYear());
  const month = String(future.getUTCMonth() + 1).padStart(2, "0");
  const day = String(future.getUTCDate()).padStart(2, "0");
  const value = `${year}${month}${day}`;
  const events = parseDistrictCalendar(`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Carleton Lodge Test//EN
BEGIN:VEVENT
UID:russell-third-degree@example.test
DTSTART;TZID=America/Toronto:${value}T193000
DTEND;TZID=America/Toronto:${value}T213000
SUMMARY:Russell Lodge No. 479 - Third Degree
LOCATION:1129 Concession Street\\, Russell
DESCRIPTION:Visitors are welcome. Confirm with the lodge before travelling.
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`);
  assertEquals(events.length, 1);
  assertEquals(events[0].degree, "third");
  assertEquals(events[0].event_time, "19:30:00");
  assertMatch(events[0].title, /Russell Lodge/);
});

Deno.test("calendar parsing preserves an all-day event's published date", () => {
  const future = new Date();
  future.setUTCMonth(future.getUTCMonth() + 1);
  future.setUTCDate(15);
  const nextDay = new Date(future);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const value = future.toISOString().slice(0, 10).replaceAll("-", "");
  const nextValue = nextDay.toISOString().slice(0, 10).replaceAll("-", "");
  const events = parseDistrictCalendar(`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Carleton Lodge Test//EN
BEGIN:VEVENT
UID:district-all-day-date@example.test
DTSTART;VALUE=DATE:${value}
DTEND;VALUE=DATE:${nextValue}
SUMMARY:District all-day event
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`);
  assertEquals(events.length, 1);
  assertEquals(events[0].event_date, future.toISOString().slice(0, 10));
  assertEquals(events[0].event_time, null);
});

Deno.test("calendar compaction drops expired history before parsing", () => {
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setUTCMonth(windowEnd.getUTCMonth() + 18);
  const compacted = compactCalendarSource(
    `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:expired@example.test
DTSTART:20120101T190000Z
DTEND:20120101T210000Z
RRULE:FREQ=MONTHLY;COUNT=9
SUMMARY:Expired lodge meeting
END:VEVENT
BEGIN:VEVENT
UID:future@example.test
DTSTART:${windowEnd.getUTCFullYear()}0101T190000Z
DTEND:${windowEnd.getUTCFullYear()}0101T210000Z
SUMMARY:Future lodge meeting
END:VEVENT
END:VCALENDAR`,
    now,
    windowEnd,
  );
  assertEquals(compacted.includes("expired@example.test"), false);
  assertEquals(compacted.includes("future@example.test"), true);
});
