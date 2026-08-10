import type { MemberActivitySummary } from './supabase';

export const MEMBER_ACTIVITY_HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000;
export const MEMBER_ACTIVITY_ACTIVE_WINDOW_DAYS = 30;
export const MEMBER_ACTIVITY_INACTIVE_WINDOW_DAYS = 90;

export type MemberActivityFilter = 'all' | 'never-login' | 'inactive-90';

export function isActivityHeartbeatDue(
  lastRecordedAt: number | null,
  now = Date.now(),
) {
  return lastRecordedAt === null
    || now - lastRecordedAt >= MEMBER_ACTIVITY_HEARTBEAT_INTERVAL_MS;
}

export function activityOccurredWithinDays(
  value: string | null,
  days: number,
  now = Date.now(),
) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    && timestamp <= now
    && now - timestamp <= days * 24 * 60 * 60 * 1000;
}

export function matchesMemberActivityFilter(
  member: MemberActivitySummary,
  filter: MemberActivityFilter,
  now = Date.now(),
) {
  if (filter === 'never-login') return member.last_login_at === null;
  if (filter === 'inactive-90') {
    return !activityOccurredWithinDays(
      member.last_seen_at,
      MEMBER_ACTIVITY_INACTIVE_WINDOW_DAYS,
      now,
    );
  }
  return true;
}
