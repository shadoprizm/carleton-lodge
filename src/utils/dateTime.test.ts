import { describe, expect, it } from 'vitest';
import { dateKey, formatDateOnly, formatTime, formatTimeRange, parseDateOnly, todayDateKey } from './dateTime';

describe('lodge date and time utilities', () => {
  it('keeps a date-only database value on the intended Toronto calendar day', () => {
    expect(formatDateOnly('2026-08-09', { weekday: 'long', month: 'long', day: 'numeric' })).toBe('Sunday, August 9');
    expect(parseDateOnly('2026-08-09').toISOString()).toBe('2026-08-09T12:00:00.000Z');
  });

  it('uses the Toronto date at the UTC day boundary', () => {
    expect(todayDateKey(new Date('2026-08-09T03:30:00Z'))).toBe('2026-08-08');
    expect(todayDateKey(new Date('2026-08-09T04:30:00Z'))).toBe('2026-08-09');
  });

  it('creates stable database date keys', () => {
    expect(dateKey(2026, 0, 4)).toBe('2026-01-04');
  });

  it('formats meeting times for people rather than databases', () => {
    expect(formatTime('00:15:00')).toBe('12:15 AM');
    expect(formatTime('18:30:00')).toBe('6:30 PM');
    expect(formatTimeRange('18:30:00', '21:00:00')).toBe('6:30 PM–9:00 PM');
    expect(formatTimeRange(null, null)).toBeNull();
  });
});
