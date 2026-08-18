import { describe, expect, it } from 'vitest';

const sourceFiles = import.meta.glob([
  '/supabase/functions/manage-lodge-email/index.ts',
  '/supabase/migrations/*_fix_handover_initiator_snapshot_permissions.sql',
], { eager: true, import: 'default', query: '?raw' }) as Record<string, string>;

const source = (fragment: string) => Object.entries(sourceFiles)
  .find(([path]) => path.includes(fragment))?.[1] ?? '';

describe('role mailbox handover audit contract', () => {
  it('records the verified Edge Function actor email with each handover', () => {
    const manager = source('manage-lodge-email');

    expect(manager).toContain('initiated_by_email_snapshot: user.email');
  });

  it('keeps the snapshot trigger invoker-safe and outside auth.users', () => {
    const migration = source('fix_handover_initiator_snapshot_permissions.sql');

    expect(migration).toContain('SECURITY INVOKER');
    expect(migration).toContain('FROM public.profiles AS profile');
    expect(migration).not.toContain('FROM auth.users');
    expect(migration).not.toContain('SECURITY DEFINER');
  });
});
