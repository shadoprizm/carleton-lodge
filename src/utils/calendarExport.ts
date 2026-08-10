import type { EventStatus } from '../lib/supabase';

type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  event_date: string;
  event_time?: string | null;
  event_end_time?: string | null;
  location?: string | null;
  location_address?: string | null;
  event_status?: EventStatus;
};

const escapeText = (value: string) => value
  .replace(/\\/g, '\\\\')
  .replace(/\r?\n/g, '\\n')
  .replace(/,/g, '\\,')
  .replace(/;/g, '\\;');

const compactDate = (date: string) => date.replace(/-/g, '');

const nextDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
};

const compactTime = (time: string) => time.replace(/:/g, '').slice(0, 6).padEnd(6, '0');

const stripHtml = (value: string) => {
  const element = document.createElement('div');
  element.innerHTML = value;
  return element.textContent?.trim() ?? '';
};

export const downloadCalendarEvent = (event: CalendarEvent) => {
  const allDay = !event.event_time;
  const start = allDay
    ? `DTSTART;VALUE=DATE:${compactDate(event.event_date)}`
    : `DTSTART;TZID=America/Toronto:${compactDate(event.event_date)}T${compactTime(event.event_time!)}`;
  const end = allDay
    ? `DTEND;VALUE=DATE:${compactDate(nextDate(event.event_date))}`
    : event.event_end_time
      ? `DTEND;TZID=America/Toronto:${compactDate(event.event_date)}T${compactTime(event.event_end_time)}`
      : null;
  const location = [event.location, event.location_address].filter(Boolean).join(', ');
  const description = event.description ? stripHtml(event.description) : '';
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Carleton Lodge No. 465//Lodge Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeText(event.id)}@carletonlodge.ca`,
    `DTSTAMP:${now}`,
    start,
    end,
    `SUMMARY:${escapeText(event.title)}`,
    description ? `DESCRIPTION:${escapeText(description)}` : null,
    location ? `LOCATION:${escapeText(location)}` : null,
    event.event_status === 'cancelled' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED',
    `URL:${escapeText(`${window.location.origin}/calendar`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((line): line is string => Boolean(line));

  const blob = new Blob([`${lines.join('\r\n')}\r\n`], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${event.event_date}-${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lodge-event'}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
