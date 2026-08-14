import { describe, expect, it } from 'vitest';

const managerSources = import.meta.glob(
  '/src/components/admin/SummonsManager.tsx',
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>;

const migrationSources = import.meta.glob(
  '/supabase/migrations/*_link_summons_to_library.sql',
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>;

const manager = Object.values(managerSources)[0] ?? '';
const migration = Object.values(migrationSources)[0] ?? '';

const notificationFunctionSources = import.meta.glob(
  '/supabase/functions/send-summons-notification/index.ts',
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>;
const notificationFunction = Object.values(notificationFunctionSources)[0] ?? '';

describe('summons publishing and library contract', () => {
  it('makes member notification an explicit opt-in', () => {
    expect(manager).toContain('useState(false)');
    expect(manager).toContain('notify_members: notifyMembers');
    expect(manager).toContain("notifyMembers ? 'Publish & Notify Members' : 'Publish'");
    expect(manager).toContain('Leave this off for historical summons');
    expect(manager).not.toContain("functions.invoke('send-summons-notification'");
    expect(migration).toContain('ALTER COLUMN notify_members SET DEFAULT false');
    expect(notificationFunction).toContain('summons.notify_members !== true');
    expect(notificationFunction).toContain('Notifications skipped');
  });

  it('uses a one-to-one linked document instead of a second upload source', () => {
    expect(manager).toContain('file_name: uploadedFile?.name ?? null');
    expect(manager).not.toContain("from('documents').insert");
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS summons_id uuid');
    expect(migration).toContain('REFERENCES public.summons(id) ON DELETE CASCADE');
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS documents_summons_id_unique');
    expect(migration).toContain('CREATE TRIGGER sync_summons_library_document');
    expect(migration).toContain('CREATE TRIGGER link_summons_library_document');
  });

  it('keeps the Summons category protected and source-backed', () => {
    expect(migration).toContain("name = 'Summons'");
    expect(migration).toContain('Summons library documents must be published from the Summons section');
    expect(migration).toContain('AND summons_id IS NULL');
  });
});
