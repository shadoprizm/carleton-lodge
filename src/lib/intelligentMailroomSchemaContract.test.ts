import { describe, expect, it } from 'vitest';

const migrationSources = import.meta.glob(
  '/supabase/migrations/*_intelligent_lodge_mailroom.sql',
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>;
const migration = Object.values(migrationSources)[0];

const functionSources = import.meta.glob(
  [
    '/supabase/functions/cl-email-webhook/index.ts',
    '/supabase/functions/cl-mailroom/index.ts',
    '/supabase/functions/_shared/mailroom-proposal.ts',
  ],
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>;
const functions = Object.values(functionSources).join('\n');
const webhook = Object.entries(functionSources).find(([path]) => path.includes('cl-email-webhook'))?.[1] ?? '';

const ingressMigrationSources = import.meta.glob(
  '/supabase/migrations/*_isolate_mailroom_ingress.sql',
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>;
const ingressMigration = Object.values(ingressMigrationSources)[0];

describe('intelligent Mailroom contract', () => {
  it('keeps publication behind review and shadow mode locked', () => {
    expect(migration).toContain("import_row.status <> 'needs_review'");
    expect(migration).toContain("import_row.processing_mode = 'shadow'");
    expect(migration).toContain('approve_intelligent_mailroom_import');
    expect(functions).toContain('Shadow-test drafts cannot be published');
  });

  it('enforces memorial privacy and education rights review', () => {
    expect(migration).toContain('announcements_memorial_privacy_check');
    expect(migration).toContain("NEW.notice_type = 'memorial'");
    expect(migration).toContain('documents_guide_rights_check');
    expect(migration).toContain('NEW.rights_reviewed IS NOT TRUE');
    expect(migration).toContain("event_payload->>'is_memorial_service'");
    expect(migration).toContain('Sensitive correspondence cannot be published');
  });

  it('limits automatic intake and district publication', () => {
    expect(functions).toContain('messageReachedMailroom');
    expect(functions).toContain('messageAuthenticationPassed');
    expect(functions).toContain('trusted_email_senders');
    expect(migration).toContain("Material outside Ottawa Districts 1 and 2 must remain on hold");
    expect(migration).toContain("district_name_value NOT IN ('Ottawa District 1', 'Ottawa District 2')");
  });

  it('rejects foreign-domain recipients before storage and limits reader access', () => {
    const recipientGuard = webhook.indexOf('if (!reachedMailroom)');
    const databaseClient = webhook.indexOf('createClient(supabaseUrl');

    expect(recipientGuard).toBeGreaterThan(-1);
    expect(databaseClient).toBeGreaterThan(-1);
    expect(recipientGuard).toBeLessThan(databaseClient);
    expect(webhook).toContain('stored: false, queued: false');
    expect(ingressMigration).toContain("mailroom@(inbound[.])?carpmasons[.]ca");
    expect(ingressMigration).toContain("has_admin_section_permission('communications', 'read')");
  });

  it('supports retries, duplicate detection, and one-year content purging', () => {
    expect(migration).toContain('FOR UPDATE SKIP LOCKED');
    expect(migration).toContain('source_attachment_sha256');
    expect(migration).toContain('carletonlodge-purge-mailroom');
    expect(functions).toContain('purgeExpired');
    expect(functions).toContain('content_purged_at');
  });
});
