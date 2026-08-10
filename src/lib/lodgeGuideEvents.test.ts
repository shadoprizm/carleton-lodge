import { describe, expect, it } from 'vitest';
import {
  lodgeGuideEventIsCurrentOrFuture,
  lodgeGuideQuestionNeedsEvents,
  lodgeGuideTorontoDateTime,
} from '../../supabase/functions/_shared/lodge-guide-events';

describe('Lodge Guide event enrichment', () => {
  it('recognizes the reported next-event question even when next is misspelled', () => {
    expect(lodgeGuideQuestionNeedsEvents('When is the enxt lodge event?')).toBe(true);
    expect(lodgeGuideQuestionNeedsEvents('Where is the latest summons?')).toBe(false);
  });

  it('uses the lodge timezone when establishing the current date and time', () => {
    expect(lodgeGuideTorontoDateTime(new Date('2026-08-09T15:39:00Z'))).toEqual({
      date: '2026-08-09',
      time: '11:39:00',
      display: '2026-08-09 11:39:00 America/Toronto',
    });
  });

  it('keeps an event that is still upcoming later today', () => {
    const lodgeNow = {
      date: '2026-08-09',
      time: '11:39:00',
      display: '2026-08-09 11:39:00 America/Toronto',
    };
    expect(lodgeGuideEventIsCurrentOrFuture({
      event_date: '2026-08-09',
      event_time: '13:00:00',
      event_end_time: '17:00:00',
    }, lodgeNow)).toBe(true);
    expect(lodgeGuideEventIsCurrentOrFuture({
      event_date: '2026-08-09',
      event_time: '08:00:00',
      event_end_time: '09:00:00',
    }, lodgeNow)).toBe(false);
  });
});
