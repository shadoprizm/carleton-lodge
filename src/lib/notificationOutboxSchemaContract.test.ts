import { describe, expect, it } from 'vitest';

const functionSources = import.meta.glob(
  '/supabase/functions/manage-member-login/index.ts',
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>;

const manageMemberLoginSource = Object.values(functionSources)[0];

describe('notification outbox schema contract', () => {
  it('does not query mailbox lifecycle fields from notification_outbox', () => {
    expect(manageMemberLoginSource).toBeTruthy();

    const notificationQueries = manageMemberLoginSource
      .split('.from("notification_outbox")')
      .slice(1)
      .map((query) => query.slice(0, 300));

    expect(notificationQueries.length).toBeGreaterThan(0);
    for (const query of notificationQueries) {
      expect(query).not.toMatch(/provisioned_at|activated_at/);
    }
  });
});
