import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createClient,
  SupabaseClient,
} from "npm:@supabase/supabase-js@2.110.8";
import ICAL from "npm:ical.js@2.2.1";
import {
  contentLengthExceeds,
  handlePreflight,
  jsonResponse,
  rejectDisallowedOrigin,
} from "../_shared/http-security.ts";

type RequestBody = {
  source_id?: unknown;
  force?: unknown;
  limit?: unknown;
};

type TrustedSource = {
  id: string;
  name: string;
  authority: "grand_lodge" | "district_1" | "district_2" | "lodge";
  district_name: "Ottawa District 1" | "Ottawa District 2" | null;
  source_kind: "page" | "calendar_ics";
  source_url: string;
  domain: string;
  enabled: boolean;
  refresh_interval_minutes: number;
  last_checked_at: string | null;
  etag: string | null;
  last_modified: string | null;
  content_hash: string | null;
  consecutive_failures: number;
};

type DistrictLodge = {
  id: string;
  district_name: string;
  name: string;
  lodge_number: string | null;
  aliases: string[];
};

type CalendarEvent = {
  external_uid: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  event_end_time: string | null;
  location: string;
  location_address: string | null;
  event_kind:
    | "meeting"
    | "emergent"
    | "installation"
    | "social"
    | "official_visit"
    | "other";
  degree:
    | "unspecified"
    | "none"
    | "first"
    | "second"
    | "third"
    | "installation"
    | "other";
};

type RefreshResult = {
  source_id: string;
  name: string;
  status: "healthy" | "unchanged" | "error";
  events?: number;
  error?: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAXIMUM_SOURCE_BYTES = 2 * 1024 * 1024;
const MAXIMUM_PAGE_CHARACTERS = 240_000;
const USER_AGENT = "CarletonLodgeGuide/1.0 (+https://carpmasons.ca/help)";

const secureEquals = (left: string, right: string) => {
  if (!left || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

const cleanString = (value: unknown, maximum = 10_000) =>
  typeof value === "string"
    ? value.replaceAll(String.fromCharCode(0), "").replace(/\s+/g, " ").trim()
      .slice(0, maximum)
    : "";

const decodeEntities = (value: string) =>
  value
    .replace(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

export const htmlToKnowledgeText = (html: string) => {
  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(script|style|noscript|svg|canvas|form|template)[^>]*>[\s\S]*?<\/\1>/gi,
      " ",
    )
    .replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(
      /<\/(p|div|section|article|main|header|footer|nav|aside|li|h[1-6]|tr)>/gi,
      "\n",
    )
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(withoutNoise)
    .replace(/\r/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAXIMUM_PAGE_CHARACTERS);
};

const htmlTitle = (html: string, fallback: string) => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ??
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return cleanString(
    decodeEntities((match?.[1] ?? "").replace(/<[^>]+>/g, " ")),
    500,
  ) ||
    fallback;
};

const sha256 = async (bytes: Uint8Array) => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", copy.buffer),
  );
  return Array.from(digest).map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const hostnameIsIpLiteral = (hostname: string) =>
  /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
  hostname.includes(":") ||
  hostname === "localhost";

export const trustedUrlIsAllowed = (
  value: string,
  allowedDomains: Set<string>,
) => {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      hostnameIsIpLiteral(hostname)
    ) return false;
    return Array.from(allowedDomains).some((domain) =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
};

const fetchTrustedUrl = async (
  source: TrustedSource,
  allowedDomains: Set<string>,
) => {
  let currentUrl = source.source_url;
  const headers = new Headers({
    "Accept": source.source_kind === "calendar_ics"
      ? "text/calendar,text/plain;q=0.9,*/*;q=0.1"
      : "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1",
    "User-Agent": USER_AGENT,
  });
  if (source.etag) headers.set("If-None-Match", source.etag);
  if (source.last_modified) {
    headers.set("If-Modified-Since", source.last_modified);
  }

  for (let redirect = 0; redirect <= 3; redirect += 1) {
    if (!trustedUrlIsAllowed(currentUrl, allowedDomains)) {
      throw new Error("The source URL is outside the approved domain list");
    }
    const response = await fetch(currentUrl, {
      method: "GET",
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The source returned an invalid redirect");
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    return { response, canonicalUrl: currentUrl };
  }
  throw new Error("The source redirected too many times");
};

const formatterParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}:${values.second}`,
  };
};

const inferDegree = (value: string): CalendarEvent["degree"] => {
  if (/\b(first|1st)\s+degree\b|(?:^|[\s(])1[º°](?:[\s);,]|$)/i.test(value)) {
    return "first";
  }
  if (/\b(second|2nd)\s+degree\b|(?:^|[\s(])2[º°](?:[\s);,]|$)/i.test(value)) {
    return "second";
  }
  if (/\b(third|3rd)\s+degree\b|(?:^|[\s(])3[º°](?:[\s);,]|$)/i.test(value)) {
    return "third";
  }
  if (/\binstallation\b/i.test(value)) return "installation";
  return "unspecified";
};

const inferEventKind = (value: string): CalendarEvent["event_kind"] => {
  if (/\bemergent\b/i.test(value)) return "emergent";
  if (/\binstallation\b/i.test(value)) return "installation";
  if (/\bofficial visit|\bddgm\b/i.test(value)) return "official_visit";
  if (
    /\b(bbq|barbecue|dinner|breakfast|social|golf|cruise|reception|fundraiser|trivia|chili|picnic)\b/i
      .test(value)
  ) return "social";
  if (/\b(lodge|meeting|degree)\b/i.test(value)) return "meeting";
  return "other";
};

const calendarWindow = () => {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 1);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 18);
  return { start, end };
};

const sourceDisplayUrl = (source: TrustedSource) => {
  if (source.source_kind !== "calendar_ics") return source.source_url;
  return source.district_name === "Ottawa District 1"
    ? "https://www.ottawadistrict1masons.ca/events/calendar"
    : "https://www.ottawamasons.ca/events-calendar/";
};

const icsPropertyValues = (block: string, property: string) => {
  const unfolded = block.replace(/\r?\n[ \t]/g, "");
  return Array.from(
    unfolded.matchAll(
      new RegExp(`^${property}(?:;[^:]*)?:(.+)$`, "gmi"),
    ),
    (match) => match[1].trim(),
  );
};

const icsDate = (value: string | undefined) => {
  const match = value?.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
};

const recurringEventCouldReachWindow = (
  start: Date,
  rule: string,
  windowStart: Date,
) => {
  const until = icsDate(rule.match(/(?:^|;)UNTIL=([^;]+)/i)?.[1]);
  if (until) {
    until.setUTCDate(until.getUTCDate() + 1);
    return until >= windowStart;
  }
  const count = Number(rule.match(/(?:^|;)COUNT=(\d+)/i)?.[1] ?? "0");
  if (!count) return true;
  const interval = Math.max(
    Number(rule.match(/(?:^|;)INTERVAL=(\d+)/i)?.[1] ?? "1"),
    1,
  );
  const frequency = rule.match(/(?:^|;)FREQ=([^;]+)/i)?.[1]?.toUpperCase();
  const finalOccurrence = new Date(start);
  const steps = Math.max(count - 1, 0) * interval;
  if (frequency === "YEARLY") {
    finalOccurrence.setUTCFullYear(finalOccurrence.getUTCFullYear() + steps);
  } else if (frequency === "MONTHLY") {
    finalOccurrence.setUTCMonth(finalOccurrence.getUTCMonth() + steps);
  } else if (frequency === "WEEKLY") {
    finalOccurrence.setUTCDate(finalOccurrence.getUTCDate() + steps * 7);
  } else if (frequency === "DAILY") {
    finalOccurrence.setUTCDate(finalOccurrence.getUTCDate() + steps);
  } else {
    return true;
  }
  // BYDAY/BYMONTH rules can move the final instance within its period.
  finalOccurrence.setUTCDate(finalOccurrence.getUTCDate() + 32);
  return finalOccurrence >= windowStart;
};

const calendarBlockCouldReachWindow = (
  block: string,
  windowStart: Date,
  windowEnd: Date,
) => {
  const starts = icsPropertyValues(block, "DTSTART")
    .map(icsDate)
    .filter((value): value is Date => value !== null);
  const recurrenceDates = [
    ...icsPropertyValues(block, "RECURRENCE-ID"),
    ...icsPropertyValues(block, "RDATE").flatMap((value) => value.split(",")),
  ].map(icsDate).filter((value): value is Date => value !== null);
  const relevantDates = [...starts, ...recurrenceDates];
  const rules = icsPropertyValues(block, "RRULE");
  if (rules.length > 0 && starts[0]) {
    return rules.some((rule) =>
      recurringEventCouldReachWindow(starts[0], rule, windowStart)
    );
  }
  const paddedStart = new Date(windowStart);
  paddedStart.setUTCDate(paddedStart.getUTCDate() - 2);
  const paddedEnd = new Date(windowEnd);
  paddedEnd.setUTCDate(paddedEnd.getUTCDate() + 2);
  return relevantDates.some((date) => date >= paddedStart && date <= paddedEnd);
};

/**
 * Public Google Calendar feeds include years of expired VEVENT records. Keep
 * calendar metadata/timezones but discard event blocks that cannot intersect
 * the search window before ICAL.js builds its in-memory component graph.
 */
export const compactCalendarSource = (
  ics: string,
  windowStart: Date,
  windowEnd: Date,
) => {
  const output: string[] = [];
  let eventBlock: string[] | null = null;
  for (const line of ics.replace(/\r\n/g, "\n").split("\n")) {
    if (eventBlock) {
      eventBlock.push(line);
      if (line.trim().toUpperCase() === "END:VEVENT") {
        const block = eventBlock.join("\r\n");
        if (calendarBlockCouldReachWindow(block, windowStart, windowEnd)) {
          output.push(...eventBlock);
        }
        eventBlock = null;
      }
      continue;
    }
    if (line.trim().toUpperCase() === "BEGIN:VEVENT") {
      eventBlock = [line];
    } else {
      output.push(line);
    }
  }
  return output.join("\r\n");
};

export const parseDistrictCalendar = (ics: string): CalendarEvent[] => {
  const { start: windowStart, end: windowEnd } = calendarWindow();
  const parsed = ICAL.parse(
    compactCalendarSource(ics, windowStart, windowEnd),
  );
  const calendar = new ICAL.Component(parsed);
  for (const timezone of calendar.getAllSubcomponents("vtimezone")) {
    try {
      ICAL.TimezoneService.register(timezone);
    } catch {
      // Duplicate timezone registrations are harmless between warm invocations.
    }
  }

  const components = calendar.getAllSubcomponents("vevent");
  const masters = new Map<string, InstanceType<typeof ICAL.Event>>();
  const exceptions: Array<InstanceType<typeof ICAL.Event>> = [];
  for (const component of components) {
    const event = new ICAL.Event(component);
    const uid = cleanString(event.uid, 500);
    if (!uid) continue;
    if (component.hasProperty("recurrence-id")) exceptions.push(event);
    else masters.set(uid, event);
  }
  for (const exception of exceptions) {
    const master = masters.get(cleanString(exception.uid, 500));
    if (master) master.relateException(exception);
  }

  const output = new Map<string, CalendarEvent>();

  const addOccurrence = (
    item: InstanceType<typeof ICAL.Event>,
    startTime: InstanceType<typeof ICAL.Time>,
    endTime: InstanceType<typeof ICAL.Time>,
  ) => {
    const status = cleanString(
      item.component.getFirstPropertyValue("status"),
      40,
    ).toUpperCase();
    if (status === "CANCELLED") return;
    const startDate = startTime.toJSDate();
    if (startDate < windowStart || startDate > windowEnd) return;
    const endDate = endTime.toJSDate();
    const startParts = formatterParts(startDate);
    const endParts = formatterParts(endDate);
    const title = cleanString(item.summary, 240);
    if (title.length < 2) return;
    const description = cleanString(item.description, 20_000) || null;
    const location = cleanString(item.location, 500) || "Location not stated";
    const allDay = Boolean(startTime.isDate);
    const combined = `${title}\n${description ?? ""}`;
    const uid = cleanString(item.uid, 500);
    const key = `${uid}:${startParts.date}:${
      allDay ? "all-day" : startParts.time
    }`;
    output.set(key, {
      external_uid: uid,
      title,
      description,
      event_date: startParts.date,
      event_time: allDay ? null : startParts.time,
      event_end_time: allDay || endParts.date !== startParts.date
        ? null
        : endParts.time,
      location,
      location_address: location === "Location not stated" ? null : location,
      event_kind: inferEventKind(combined),
      degree: inferDegree(combined),
    });
  };

  for (const event of masters.values()) {
    if (event.isRecurring()) {
      const iterator = event.iterator();
      for (let count = 0; count < 10_000; count += 1) {
        const next = iterator.next();
        if (!next) break;
        const nextDate = next.toJSDate();
        if (nextDate > windowEnd) break;
        if (nextDate < windowStart) continue;
        const occurrence = event.getOccurrenceDetails(next);
        addOccurrence(
          occurrence.item,
          occurrence.startDate,
          occurrence.endDate,
        );
      }
    } else {
      addOccurrence(event, event.startDate, event.endDate);
    }
  }

  for (const exception of exceptions) {
    if (!masters.has(cleanString(exception.uid, 500))) {
      addOccurrence(exception, exception.startDate, exception.endDate);
    }
  }

  return Array.from(output.values())
    .sort((left, right) =>
      `${left.event_date} ${left.event_time ?? ""}`.localeCompare(
        `${right.event_date} ${right.event_time ?? ""}`,
      )
    )
    .slice(0, 500);
};

const normalizeLodgeText = (value: string) =>
  value.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|no|number|lodge)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const matchDistrictLodge = (event: CalendarEvent, lodges: DistrictLodge[]) => {
  const haystack = normalizeLodgeText(
    `${event.title} ${event.description ?? ""}`,
  );
  let best: { lodge: DistrictLodge; score: number } | null = null;
  for (const lodge of lodges) {
    const candidates = [lodge.name, ...(lodge.aliases ?? [])]
      .map(normalizeLodgeText)
      .filter((candidate) => candidate.length >= 3);
    const nameScore = candidates.reduce(
      (score, candidate) =>
        Math.max(score, haystack.includes(candidate) ? candidate.length : 0),
      0,
    );
    const numberScore = lodge.lodge_number &&
        new RegExp(`(?:^|\\D)${lodge.lodge_number}(?:\\D|$)`).test(
          `${event.title} ${event.description ?? ""}`,
        )
      ? 50
      : 0;
    const score = Math.max(nameScore, numberScore);
    if (score > 0 && (!best || score > best.score)) best = { lodge, score };
  }
  return best?.lodge ?? null;
};

const upsertPage = async (
  adminClient: SupabaseClient,
  source: TrustedSource,
  canonicalUrl: string,
  title: string,
  cleanText: string,
  contentHash: string,
  fetchedAt: string,
  lastModified: string | null,
) => {
  const publishedAt = lastModified && !Number.isNaN(Date.parse(lastModified))
    ? new Date(lastModified).toISOString()
    : null;
  const { error } = await adminClient.from("trusted_knowledge_pages").upsert({
    source_id: source.id,
    canonical_url: canonicalUrl,
    title,
    clean_text: cleanText,
    content_hash: contentHash,
    fetched_at: fetchedAt,
    source_published_at: publishedAt,
  }, { onConflict: "source_id" });
  if (error) throw error;
};

const syncCalendarEvents = async (
  adminClient: SupabaseClient,
  source: TrustedSource,
  events: CalendarEvent[],
  checkedAt: string,
) => {
  if (!source.district_name) throw new Error("Calendar source has no district");
  const { data: lodgeRows, error: lodgeError } = await adminClient
    .from("district_lodges")
    .select("id, district_name, name, lodge_number, aliases")
    .eq("district_name", source.district_name);
  if (lodgeError) throw lodgeError;
  const lodges = (lodgeRows ?? []) as DistrictLodge[];

  const keptIds = new Set<string>();
  for (const event of events) {
    const lodge = matchDistrictLodge(event, lodges);
    const { data, error } = await adminClient.from("district_events").upsert({
      lodge_id: lodge?.id ?? null,
      summons_id: null,
      district_name: source.district_name,
      trusted_source_id: source.id,
      external_uid: event.external_uid,
      source_url: sourceDisplayUrl(source),
      source_checked_at: checkedAt,
      title: event.title,
      description: event.description,
      event_date: event.event_date,
      event_time: event.event_time,
      event_end_time: event.event_end_time,
      location: event.location,
      location_address: event.location_address,
      event_kind: event.event_kind,
      degree: event.degree,
      contact_name: null,
      contact_details: null,
    }, {
      onConflict: "trusted_source_id,external_uid,event_date,event_time",
    }).select("id").single();
    if (error) throw error;
    if (data?.id) keptIds.add(data.id as string);
  }

  const today = formatterParts(new Date()).date;
  const { data: existing, error: existingError } = await adminClient
    .from("district_events")
    .select("id")
    .eq("trusted_source_id", source.id)
    .gte("event_date", today);
  if (existingError) throw existingError;
  const staleIds = (existing ?? [])
    .map((row) => row.id as string)
    .filter((id) => !keptIds.has(id));
  if (staleIds.length > 0) {
    const { error: deleteError } = await adminClient
      .from("district_events")
      .delete()
      .in("id", staleIds);
    if (deleteError) throw deleteError;
  }
};

const refreshSource = async (
  adminClient: SupabaseClient,
  source: TrustedSource,
  allowedDomains: Set<string>,
): Promise<RefreshResult> => {
  const checkedAt = new Date().toISOString();
  await adminClient.from("trusted_knowledge_sources")
    .update({ fetch_status: "refreshing", last_error: null })
    .eq("id", source.id);
  try {
    const { response, canonicalUrl } = await fetchTrustedUrl(
      source,
      allowedDomains,
    );
    if (response.status === 304) {
      const { error } = await adminClient.from("trusted_knowledge_sources")
        .update({
          fetch_status: "unchanged",
          last_checked_at: checkedAt,
          last_success_at: checkedAt,
          last_http_status: 304,
          last_error: null,
          consecutive_failures: 0,
        }).eq("id", source.id);
      if (error) throw error;
      return { source_id: source.id, name: source.name, status: "unchanged" };
    }
    if (!response.ok) {
      throw new Error(`Official site returned HTTP ${response.status}`);
    }
    const declaredLength = Number(
      response.headers.get("content-length") ?? "0",
    );
    if (declaredLength > MAXIMUM_SOURCE_BYTES) {
      throw new Error("Source response is too large");
    }
    const contentType = (response.headers.get("content-type") ?? "")
      .toLowerCase();
    if (
      source.source_kind === "calendar_ics"
        ? !contentType.includes("text/calendar") &&
          !contentType.includes("text/plain")
        : !contentType.includes("text/html") &&
          !contentType.includes("application/xhtml+xml") &&
          !contentType.includes("text/plain")
    ) {
      throw new Error(
        `Unsupported source content type: ${contentType || "unknown"}`,
      );
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAXIMUM_SOURCE_BYTES) {
      throw new Error("Source response is too large");
    }
    const rawText = new TextDecoder().decode(bytes);
    const contentHash = await sha256(bytes);
    const unchanged = source.content_hash === contentHash;
    let eventsCount: number | undefined;

    if (!unchanged) {
      if (source.source_kind === "calendar_ics") {
        const events = parseDistrictCalendar(rawText);
        const calendarText = [
          `${source.name}. Official public calendar checked ${checkedAt}.`,
          ...events.map((event) =>
            [
              event.title,
              event.event_date,
              event.event_time ?? "all day",
              event.location,
              event.degree === "unspecified" ? null : `${event.degree} degree`,
              event.description,
            ].filter(Boolean).join(" — ")
          ),
        ].join("\n").slice(0, MAXIMUM_PAGE_CHARACTERS);
        await syncCalendarEvents(adminClient, source, events, checkedAt);
        await upsertPage(
          adminClient,
          source,
          sourceDisplayUrl(source),
          source.name,
          calendarText ||
            `${source.name}. No upcoming public events are currently listed.`,
          contentHash,
          checkedAt,
          response.headers.get("last-modified"),
        );
        eventsCount = events.length;
      } else {
        const cleanText = contentType.includes("text/plain")
          ? cleanString(rawText, MAXIMUM_PAGE_CHARACTERS)
          : htmlToKnowledgeText(rawText);
        if (cleanText.length < 80) {
          throw new Error(
            "The page did not contain enough readable public text",
          );
        }
        await upsertPage(
          adminClient,
          source,
          canonicalUrl,
          htmlTitle(rawText, source.name),
          cleanText,
          contentHash,
          checkedAt,
          response.headers.get("last-modified"),
        );
      }
    }

    const status = unchanged ? "unchanged" : "healthy";
    const sourceUpdate: Record<string, unknown> = {
      fetch_status: status,
      last_checked_at: checkedAt,
      last_success_at: checkedAt,
      last_http_status: response.status,
      last_error: null,
      consecutive_failures: 0,
      etag: response.headers.get("etag"),
      last_modified: response.headers.get("last-modified"),
      content_hash: contentHash,
    };
    if (!unchanged) sourceUpdate.last_changed_at = checkedAt;
    const { error: updateError } = await adminClient.from(
      "trusted_knowledge_sources",
    )
      .update(sourceUpdate).eq("id", source.id);
    if (updateError) throw updateError;
    return {
      source_id: source.id,
      name: source.name,
      status,
      events: eventsCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await adminClient.from("trusted_knowledge_sources").update({
      fetch_status: "error",
      last_checked_at: checkedAt,
      last_error: message.slice(0, 1000),
      consecutive_failures: source.consecutive_failures + 1,
    }).eq("id", source.id);
    console.error("Trusted source refresh failed", source.id, message);
    return {
      source_id: source.id,
      name: source.name,
      status: "error",
      error: message.slice(0, 300),
    };
  }
};

const sourceIsDue = (source: TrustedSource, force: boolean) => {
  if (force || !source.last_checked_at) return true;
  return Date.now() - Date.parse(source.last_checked_at) >=
    source.refresh_interval_minutes * 60_000;
};

export const handler = async (req: Request) => {
  if (req.method === "OPTIONS") return handlePreflight(req);
  const originRejection = rejectDisallowedOrigin(req);
  if (originRejection) return originRejection;
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405, {
      "Allow": "POST, OPTIONS",
    });
  }
  if (contentLengthExceeds(req, 8 * 1024)) {
    return jsonResponse(req, { error: "Request body is too large" }, 413);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("TRUSTED_SOURCE_CRON_SECRET") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const isScheduledCall = secureEquals(
    req.headers.get("x-cron-secret") ?? "",
    cronSecret,
  );
  if (
    !supabaseUrl || !anonKey || !serviceRoleKey || !cronSecret
  ) {
    return jsonResponse(req, {
      error: "Trusted source refresh is not configured",
    }, 503);
  }

  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch {
    return jsonResponse(req, { error: "Invalid JSON body" }, 400);
  }
  if (!isScheduledCall) {
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse(req, { error: "Sign in is required" }, 401);
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth
      .getUser();
    if (userError || !userData.user) {
      return jsonResponse(req, { error: "Your sign-in has expired" }, 401);
    }
    const { data: canManage } = await userClient.rpc(
      "has_admin_section_permission",
      {
        target_section: "communications",
        access_level: "write",
      },
    );
    if (canManage !== true) {
      return jsonResponse(req, { error: "Forbidden" }, 403);
    }
  }

  const requestedSourceId = typeof body.source_id === "string"
    ? body.source_id
    : "";
  if (requestedSourceId && !UUID_PATTERN.test(requestedSourceId)) {
    return jsonResponse(
      req,
      { error: "A valid trusted source is required" },
      400,
    );
  }
  const force = body.force === true || Boolean(requestedSourceId);
  const requestedLimit = typeof body.limit === "number"
    ? Math.trunc(body.limit)
    : 4;
  const limit = Math.min(Math.max(requestedLimit, 1), 40);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let sourceQuery = adminClient.from("trusted_knowledge_sources").select(
    "id, name, authority, district_name, source_kind, source_url, domain, enabled, refresh_interval_minutes, last_checked_at, etag, last_modified, content_hash, consecutive_failures",
  ).eq("enabled", true).order("last_checked_at", {
    ascending: true,
    nullsFirst: true,
  });
  if (requestedSourceId) sourceQuery = sourceQuery.eq("id", requestedSourceId);
  const { data, error } = await sourceQuery;
  if (error) {
    console.error("Trusted source query failed", error);
    return jsonResponse(
      req,
      { error: "Trusted sources could not be loaded" },
      500,
    );
  }
  const allSources = (data ?? []) as TrustedSource[];
  const selectedSources = allSources.filter((source) =>
    sourceIsDue(source, force)
  ).slice(0, limit);
  const allowedDomains = new Set(
    allSources.map((source) => source.domain.toLowerCase()),
  );

  // Parse sources sequentially. Several district sites return large generated
  // HTML documents; processing them concurrently can exceed an Edge worker's
  // memory allowance even though each response is individually bounded.
  const results: RefreshResult[] = [];
  for (const source of selectedSources) {
    results.push(await refreshSource(adminClient, source, allowedDomains));
  }

  return jsonResponse(req, {
    checked: results.length,
    healthy: results.filter((result) => result.status === "healthy").length,
    unchanged: results.filter((result) => result.status === "unchanged").length,
    failed: results.filter((result) => result.status === "error").length,
    remaining_due: Math.max(
      allSources.filter((source) => sourceIsDue(source, force)).length -
        results.length,
      0,
    ),
    results,
  });
};

if (import.meta.main) Deno.serve(handler);
