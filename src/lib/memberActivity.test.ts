import { describe, expect, it } from 'vitest';
import type { MemberActivitySummary } from './supabase';
import {
  MEMBER_ACTIVITY_HEARTBEAT_INTERVAL_MS,
  activityOccurredWithinDays,
  isActivityHeartbeatDue,
  matchesMemberActivityFilter,
} from './memberActivity';

const member = (overrides: Partial<MemberActivitySummary> = {}): MemberActivitySummary => ({
  profile_id: 'profile-1',
  full_name: 'Example Member',
  email: 'member@example.test',
  joined_at: '2026-01-01T00:00:00Z',
  last_login_at: '2026-08-10T12:00:00Z',
  last_seen_at: '2026-08-10T12:15:00Z',
  ...overrides,
});

describe('member activity', () => {
  it('throttles heartbeats for fifteen minutes', () => {
    const now = Date.parse('2026-08-10T12:20:00Z');
    expect(isActivityHeartbeatDue(null, now)).toBe(true);
    expect(isActivityHeartbeatDue(now - MEMBER_ACTIVITY_HEARTBEAT_INTERVAL_MS + 1, now)).toBe(false);
    expect(isActivityHeartbeatDue(now - MEMBER_ACTIVITY_HEARTBEAT_INTERVAL_MS, now)).toBe(true);
  });

  it('identifies recent activity using a stable clock', () => {
    const now = Date.parse('2026-08-10T12:20:00Z');
    expect(activityOccurredWithinDays('2026-08-01T00:00:00Z', 30, now)).toBe(true);
    expect(activityOccurredWithinDays('2026-06-01T00:00:00Z', 30, now)).toBe(false);
    expect(activityOccurredWithinDays(null, 30, now)).toBe(false);
  });

  it('filters never-signed-in and inactive accounts independently', () => {
    const now = Date.parse('2026-08-10T12:20:00Z');
    expect(matchesMemberActivityFilter(member({ last_login_at: null }), 'never-login', now)).toBe(true);
    expect(matchesMemberActivityFilter(member(), 'never-login', now)).toBe(false);
    expect(matchesMemberActivityFilter(member({ last_seen_at: null }), 'inactive-90', now)).toBe(true);
    expect(matchesMemberActivityFilter(member(), 'inactive-90', now)).toBe(false);
  });
});
