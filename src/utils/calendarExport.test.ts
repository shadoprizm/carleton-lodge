import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadCalendarEvent } from './calendarExport';

const readBlob = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result ?? ''));
  reader.onerror = () => reject(reader.error);
  reader.readAsText(blob);
});

describe('calendar export', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates a Toronto-time calendar file with safe escaped content', async () => {
    let calendarBlob: Blob | null = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      calendarBlob = blob as Blob;
      return 'blob:calendar';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    downloadCalendarEvent({
      id: 'event-123',
      title: 'Dinner, Meeting',
      description: '<p>Bring an apron.</p>',
      event_date: '2026-08-09',
      event_time: '18:30:00',
      event_end_time: '21:00:00',
      location: 'Carleton Lodge Hall',
      location_address: 'Carp, Ontario',
      event_status: 'scheduled',
    });

    expect(calendarBlob).not.toBeNull();
    const contents = await readBlob(calendarBlob!);
    expect(contents).toContain('DTSTART;TZID=America/Toronto:20260809T183000');
    expect(contents).toContain('DTEND;TZID=America/Toronto:20260809T210000');
    expect(contents).toContain('SUMMARY:Dinner\\, Meeting');
    expect(contents).toContain('DESCRIPTION:Bring an apron.');
    expect(contents).toContain('STATUS:CONFIRMED');
  });

  it('exports an undated-time event as an all-day event ending the next day', async () => {
    let calendarBlob: Blob | null = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      calendarBlob = blob as Blob;
      return 'blob:calendar';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    downloadCalendarEvent({ id: 'event-456', title: 'Lodge Event', event_date: '2026-12-31' });

    const contents = await readBlob(calendarBlob!);
    expect(contents).toContain('DTSTART;VALUE=DATE:20261231');
    expect(contents).toContain('DTEND;VALUE=DATE:20270101');
  });
});
