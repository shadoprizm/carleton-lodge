import { describe, expect, it } from 'vitest';

const migrationSources = import.meta.glob(
  '/supabase/migrations/*_member_self_service_profiles.sql',
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>;

const migrationSource = Object.values(migrationSources)[0];

const directorySources = import.meta.glob(
  [
    '/src/pages/MemberProfilePage.tsx',
    '/src/components/MembersDirectory.tsx',
    '/supabase/functions/_shared/lodge-guide-members.ts',
  ],
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>;

describe('member self-service database contract', () => {
  it('keeps member writes behind an active-session field allowlist', () => {
    expect(migrationSource).toBeTruthy();
    expect(migrationSource).toContain('private.has_active_session()');
    expect(migrationSource).toContain('private.update_my_member_profile');
    expect(migrationSource).toMatch(/phone = nullif\(btrim\(new_phone\), ''\)/);
    expect(migrationSource).toMatch(/address = nullif\(btrim\(new_address\), ''\)/);
    expect(migrationSource).toMatch(/bio = nullif\(btrim\(new_bio\), ''\)/);
    expect(migrationSource).not.toMatch(/SET[\s\S]{0,300}grand_lodge_membership_number\s*=/);
  });

  it('allows linked members to read hidden profiles without exposing private columns directly', () => {
    expect(migrationSource).toContain('linked_profile_id = (SELECT auth.uid())');
    expect(migrationSource).toContain('REVOKE SELECT (address, grand_lodge_membership_number)');
    expect(migrationSource).toContain('lodge_members_grand_lodge_number_unique_idx');
    expect(migrationSource).toContain('REVOKE ALL ON FUNCTION public.update_my_member_profile');
  });

  it('keeps private address and membership-number fields out of shared directory surfaces', () => {
    expect(Object.keys(directorySources)).toHaveLength(3);
    for (const source of Object.values(directorySources)) {
      expect(source).not.toContain('grand_lodge_membership_number');
      expect(source).not.toMatch(/\.address\b|\baddress:/);
    }
  });
});
