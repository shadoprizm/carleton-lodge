export type LodgeGuideLocalDateTime = {
  date: string;
  time: string;
  display: string;
};

export type LodgeGuideEventTiming = {
  event_date: string;
  event_time: string | null;
  event_end_time: string | null;
};

const EVENT_QUESTION_PATTERN = /\b(event|events|meeting|meetings|calendar|bbq|barbecue|gathering|gatherings|installation|installations)\b/i;

export const lodgeGuideQuestionNeedsEvents = (question: string) =>
  EVENT_QUESTION_PATTERN.test(question);

export const lodgeGuideTorontoDateTime = (now = new Date()): LodgeGuideLocalDateTime => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = `${values.year}-${values.month}-${values.day}`;
  const time = `${values.hour}:${values.minute}:${values.second}`;
  return { date, time, display: `${date} ${time} America/Toronto` };
};

export const lodgeGuideEventIsCurrentOrFuture = (
  event: LodgeGuideEventTiming,
  lodgeNow: LodgeGuideLocalDateTime,
) => {
  if (event.event_date > lodgeNow.date) return true;
  if (event.event_date < lodgeNow.date) return false;
  const lastRelevantTime = event.event_end_time ?? event.event_time ?? "23:59:59";
  return lastRelevantTime >= lodgeNow.time;
};
