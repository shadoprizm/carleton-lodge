export const LODGE_TIME_ZONE = 'America/Toronto';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateOnly(value: string): Date {
  const match = DATE_ONLY_PATTERN.exec(value.slice(0, 10));
  if (!match) return new Date(value);

  const [, year, month, day] = match;
  // Noon UTC remains on the same calendar date in every Canadian time zone.
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
}

export function formatDateOnly(
  value: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  },
  locale = 'en-CA'
) {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: LODGE_TIME_ZONE,
  }).format(parseDateOnly(value));
}

export function dateKey(year: number, zeroBasedMonth: number, day: number) {
  return `${year}-${String(zeroBasedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function todayDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LODGE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatTime(time: string | null) {
  if (!time) return null;
  const [hours, minutes] = time.split(':');
  const hour = Number(hours);
  if (!Number.isFinite(hour)) return time;

  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${minutes} ${suffix}`;
}

export function formatTimeRange(start: string | null, end: string | null) {
  const formattedStart = formatTime(start);
  const formattedEnd = formatTime(end);
  if (!formattedStart) return null;
  return formattedEnd ? `${formattedStart}–${formattedEnd}` : formattedStart;
}
