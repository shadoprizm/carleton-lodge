import { describe, expect, it } from 'vitest';

const functionSources = import.meta.glob(
  [
    '/supabase/functions/cl-process-notifications/index.ts',
    '/supabase/functions/manage-lodge-email/index.ts',
    '/supabase/functions/manage-role-mailbox-reminders/index.ts',
    '/supabase/functions/_shared/role-mailbox-activation.ts',
    '/supabase/functions/_shared/role-mailbox-reminder-opt-out.ts',
  ],
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>;

const processor = Object.entries(functionSources).find(([path]) =>
  path.includes('cl-process-notifications')
)?.[1] ?? '';
const manager = Object.entries(functionSources).find(([path]) => path.includes('manage-lodge-email'))?.[1] ?? '';
const activation = Object.entries(functionSources).find(([path]) =>
  path.includes('_shared/role-mailbox-activation')
)?.[1] ?? '';
const optOutEndpoint = Object.entries(functionSources).find(([path]) =>
  path.includes('manage-role-mailbox-reminders')
)?.[1] ?? '';
const optOutTokens = Object.entries(functionSources).find(([path]) =>
  path.includes('_shared/role-mailbox-reminder-opt-out')
)?.[1] ?? '';
const frontendSources = import.meta.glob(
  '/src/pages/RoleMailboxReminderPreferencesPage.tsx',
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>;
const optOutPage = Object.values(frontendSources)[0] ?? '';

const migrationSources = import.meta.glob(
  '/supabase/migrations/*_add_role_mailbox_activation_reminder_windows.sql',
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>;
const migration = Object.values(migrationSources)[0];
const optOutMigrationSources = import.meta.glob(
  '/supabase/migrations/*_add_role_mailbox_reminder_opt_out.sql',
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>;
const optOutMigration = Object.values(optOutMigrationSources)[0];

describe('role mailbox activation reminder contract', () => {
  it('uses three complete 72-hour activation windows', () => {
    expect(activation).toContain('ROLE_MAILBOX_ACTIVATION_WINDOW_HOURS = 72');
    expect(activation).toContain('ROLE_MAILBOX_ACTIVATION_MAX_WINDOWS = 3');
    expect(processor).toContain('nextRoleMailboxActivationWindow');
    expect(processor).toContain('.lte("expires_at", now)');
    expect(manager).toContain('ROLE_MAILBOX_ACTIVATION_INITIAL_WINDOW');
  });

  it('only renews the same pending officer or functional assignment', () => {
    expect(processor).toContain('shouldQueueRoleMailboxActivationReminder');
    expect(activation).toContain('accountStatus === "INVITATION_PENDING"');
    expect(activation).toContain('currentAuthorizedMemberId === input.memberId');
    expect(activation).toContain('input.hasPendingAssignment');
    expect(processor).toContain('.in("status", ["queued", "processing"])');
    expect(processor).toContain('hasPendingInvitation');
    expect(processor).toContain('Role mailbox assignment is no longer pending for this recipient');
  });

  it('records the window and excludes final windows from the due scan', () => {
    expect(migration).toContain('activation_window BETWEEN 1 AND 3');
    expect(migration).toContain('activation_window < 3');
    expect(processor).toContain('.lt("activation_window", ROLE_MAILBOX_ACTIVATION_MAX_WINDOWS)');
    expect(migration).not.toContain('cron.schedule');
    expect(migration).not.toContain('isnxsygngysxgzeuhmjm.supabase.co');
  });

  it('labels the third message as final and directs the holder to support', () => {
    expect(processor).toContain('Final reminder: Activate the');
    expect(processor).toContain('final automated activation reminder');
    expect(processor).toContain('support@carpmasons.ca');
  });

  it('lets each pending assignment opt out of automated reminders', () => {
    expect(optOutMigration).toContain('activation_reminders_opted_out_at');
    expect(optOutMigration).toContain('queue_role_mailbox_activation_reminder');
    expect(processor).toContain('assignment.activation_reminders_opted_out_at');
    expect(processor).toContain('Stop these reminders');
    expect(optOutEndpoint).toContain('ROLE_MAILBOX_ACTIVATION_REMINDERS_OPTED_OUT');
  });

  it('requires confirmation before changing the reminder preference', () => {
    expect(processor).toContain('/email-reminders#token=');
    expect(optOutPage).toContain('Stop future reminders?');
    expect(optOutPage).toContain("'manage-role-mailbox-reminders'");
    expect(optOutEndpoint).toContain('if (req.method !== "POST")');
    expect(optOutEndpoint).toContain('activation_reminders_opted_out_at: now');
  });

  it('stores only hashed opt-out tokens behind service-role access', () => {
    expect(optOutTokens).toContain('HMAC');
    expect(optOutTokens).toContain('SHA-256');
    expect(processor).not.toContain('reminder_opt_out_token');
    expect(optOutMigration).toContain('token_hash text NOT NULL UNIQUE');
    expect(optOutMigration).toContain('ENABLE ROW LEVEL SECURITY');
    expect(optOutMigration).toContain('FROM PUBLIC, anon, authenticated');
  });
});
