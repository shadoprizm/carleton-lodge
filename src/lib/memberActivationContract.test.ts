import { describe, expect, it } from 'vitest';

const sourceFiles = import.meta.glob([
  '/supabase/functions/request-member-access-code/index.ts',
  '/supabase/functions/manage-member-login/index.ts',
  '/supabase/functions/cl-process-notifications/index.ts',
  '/supabase/migrations/*_member_self_service_activation.sql',
], { eager: true, import: 'default', query: '?raw' }) as Record<string, string>;

const source = (fragment: string) => Object.entries(sourceFiles)
  .find(([path]) => path.includes(fragment))?.[1] ?? '';

describe('member self-service activation contract', () => {
  it('keeps public code requests account-neutral and rate limited', () => {
    const requestFunction = source('request-member-access-code');
    expect(requestFunction).toContain('MEMBER_ACCESS_GENERIC_MESSAGE');
    expect(requestFunction).toContain('member-access-code-ip');
    expect(requestFunction).toContain('member-access-code-email');
    expect(requestFunction).toContain('force_password_change: false');
  });

  it('generates the six-digit code only while the email is being delivered', () => {
    const processor = source('cl-process-notifications');
    const requestFunction = source('request-member-access-code');
    expect(processor).toContain('notification_type === "member_access_code"');
    expect(processor).toContain('type: "magiclink"');
    expect(processor).toContain('email_otp');
    expect(requestFunction).not.toContain('email_otp');
    expect(requestFunction).not.toContain('secureActionCode');
  });

  it('decouples activation invitations from Lodge mailbox provisioning', () => {
    const invitationFunction = source('manage-member-login');
    expect(invitationFunction).toContain('member_activation_invitation');
    expect(invitationFunction).not.toContain('lodge_email_accounts');
    expect(invitationFunction).not.toContain('createMxrouteProvider');
    expect(invitationFunction).not.toContain('createUser');
  });

  it('identifies the webmaster who sent the activation invitation', () => {
    const processor = source('cl-process-notifications');
    expect(processor).toContain(
      'Fraternally,\\nBro. Jeramy Ratelle\\nWebmaster\\nCarleton Lodge No. 465',
    );
  });

  it('tracks invitation, request, and successful activation separately', () => {
    const migration = source('member_self_service_activation.sql');
    expect(migration).toContain('website_activation_invited_at');
    expect(migration).toContain('website_activation_requested_at');
    expect(migration).toContain('website_activated_at');
  });
});
