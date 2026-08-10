import { describe, expect, it } from 'vitest';
import { AdminSectionPermission, hasSectionPermission } from './adminPermissions';

const permission = (overrides: Partial<AdminSectionPermission> = {}): AdminSectionPermission => ({
  id: 'permission-1',
  profile_id: 'profile-1',
  section: 'events',
  can_read: true,
  can_write: false,
  can_approve: false,
  granted_by: null,
  created_at: '2026-08-08T00:00:00Z',
  updated_at: '2026-08-08T00:00:00Z',
  ...overrides,
});

describe('section permissions', () => {
  it('gives full administrators access to every level', () => {
    expect(hasSectionPermission(true, [], 'communications', 'write')).toBe(true);
    expect(hasSectionPermission(true, [], 'events', 'approve')).toBe(true);
  });

  it('does not turn read access into write access', () => {
    expect(hasSectionPermission(false, [permission()], 'events', 'read')).toBe(true);
    expect(hasSectionPermission(false, [permission()], 'events', 'write')).toBe(false);
  });

  it('limits approval permission to events', () => {
    const approver = permission({ can_read: false, can_approve: true });
    expect(hasSectionPermission(false, [approver], 'events', 'approve')).toBe(true);
    expect(hasSectionPermission(false, [{ ...approver, section: 'communications' }], 'communications', 'approve')).toBe(false);
  });
});
