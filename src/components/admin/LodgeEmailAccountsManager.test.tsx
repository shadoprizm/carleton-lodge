import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LodgeEmailAccount, LodgeMember, LodgePosition } from '../../lib/supabase';
import { LodgeEmailAccountsManager } from './LodgeEmailAccountsManager';

const { fromMock, functionInvokeMock, hasAdminPermissionMock, rpcMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  functionInvokeMock: vi.fn(),
  hasAdminPermissionMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ hasAdminPermission: hasAdminPermissionMock }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: fromMock,
    functions: { invoke: functionInvokeMock },
    rpc: rpcMock,
  },
}));

const position: LodgePosition = {
  id: 'position-1',
  name: 'Secretary',
  display_order: 1,
  position_type: 'OFFICER',
  max_holders: 1,
  created_at: '2020-01-01T00:00:00Z',
};

const member: LodgeMember = {
  id: 'member-1',
  full_name: 'Example Member',
  email: 'member@example.com',
  phone: null,
  alternate_phone: null,
  address: null,
  spouse_name: null,
  grand_lodge_membership_number: null,
  join_date: null,
  position_id: position.id,
  bio: null,
  visible_to_members: true,
  linked_profile_id: 'profile-1',
  lodge_email: 'example.member@carpmasons.ca',
  mailbox_status: 'active',
  mailbox_quota_mb: 250,
  mailbox_send_limit: 100,
  mailbox_provisioned_at: '2026-08-01T12:00:00Z',
  mailbox_activated_at: '2026-08-02T12:00:00Z',
  website_activation_invited_at: '2026-08-01T10:00:00Z',
  website_activation_requested_at: '2026-08-01T11:00:00Z',
  website_activated_at: '2026-08-01T12:00:00Z',
  created_at: '2020-01-01T00:00:00Z',
  updated_at: '2026-08-10T12:00:00Z',
};

const baseAccount: LodgeEmailAccount = {
  id: 'account-1',
  address: 'secretary@carpmasons.ca',
  account_type: 'OFFICER',
  status: 'ACTIVE',
  provider: 'mxroute',
  provider_mailbox_identifier: 'secretary@carpmasons.ca',
  associated_member_id: null,
  position_id: position.id,
  current_authorized_member_id: member.id,
  display_name: 'Lodge Secretary',
  enabled: true,
  handover_behavior: 'ROTATE_CREDENTIALS',
  agreement_required: true,
  credential_status: 'USER_SET',
  provider_status: {},
  provisioned_at: '2026-08-01T12:00:00Z',
  activated_at: '2026-08-02T12:00:00Z',
  suspended_at: null,
  disabled_at: null,
  last_credential_rotation_at: '2026-08-03T12:00:00Z',
  last_handover_at: '2026-08-04T12:00:00Z',
  created_at: '2026-08-01T12:00:00Z',
  updated_at: '2026-08-04T12:00:00Z',
};

const functionalAccount: LodgeEmailAccount = {
  ...baseAccount,
  id: 'account-2',
  address: 'events@carpmasons.ca',
  account_type: 'FUNCTIONAL',
  position_id: null,
  current_authorized_member_id: null,
  display_name: 'Lodge Events',
  status: 'NOT_PROVISIONED',
  provider_mailbox_identifier: null,
  credential_status: 'UNKNOWN',
  provisioned_at: null,
  activated_at: null,
  last_credential_rotation_at: null,
  last_handover_at: null,
};

const personalAccount: LodgeEmailAccount = {
  ...baseAccount,
  id: 'account-3',
  address: 'example.member@carpmasons.ca',
  account_type: 'MEMBER',
  position_id: null,
  associated_member_id: member.id,
  current_authorized_member_id: null,
  display_name: 'Example Member',
};

function orderedResult(data: unknown[]) {
  return {
    select: vi.fn(() => ({
      order: vi.fn().mockResolvedValue({ data, error: null }),
    })),
  };
}

describe('LodgeEmailAccountsManager compact mailbox management', () => {
  beforeEach(() => {
    fromMock.mockReset();
    functionInvokeMock.mockReset();
    hasAdminPermissionMock.mockReset();
    rpcMock.mockReset();
    hasAdminPermissionMock.mockReturnValue(true);
    rpcMock.mockResolvedValue({ data: [member], error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === 'lodge_email_accounts') return orderedResult([baseAccount, functionalAccount, personalAccount]);
      if (table === 'lodge_positions') return orderedResult([position]);
      if (table === 'officer_mailbox_assignments' || table === 'officer_email_handovers') return orderedResult([]);
      if (table === 'lodge_email_audit_events') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
        };
      }
      if (table === 'email_policy_versions') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  afterEach(() => cleanup());

  it('starts compact, opens one role mailbox at a time, and filters without a table', async () => {
    render(<LodgeEmailAccountsManager />);

    const secretary = await screen.findByRole('button', { name: 'Manage mailbox secretary@carpmasons.ca' });
    const events = screen.getByRole('button', { name: 'Manage mailbox events@carpmasons.ca' });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(secretary).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Password Reset' })).not.toBeInTheDocument();

    fireEvent.click(secretary);
    expect(secretary).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Password Reset' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Handover' })).toBeInTheDocument();

    fireEvent.click(events);
    expect(secretary).toHaveAttribute('aria-expanded', 'false');
    expect(events).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('button', { name: 'Password Reset' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Provision' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search Lodge mailboxes'), { target: { value: 'Secretary' } });
    expect(screen.getByText('Showing 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage mailbox secretary@carpmasons.ca' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage mailbox events@carpmasons.ca' })).not.toBeInTheDocument();
  });

  it('puts personal mailbox actions inside the expanded personal account panel', async () => {
    render(<LodgeEmailAccountsManager />);

    fireEvent.click(await screen.findByRole('tab', { name: /Personal Mailboxes/ }));
    const personal = screen.getByRole('button', { name: 'Manage mailbox example.member@carpmasons.ca' });

    expect(personal).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Suspend' })).not.toBeInTheDocument();

    fireEvent.click(personal);
    expect(personal).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Password Reset' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suspend' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Details & History' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Handover' })).not.toBeInTheDocument();
  });

  it('offers an explicit recovery action for roster members missing personal mailboxes', async () => {
    rpcMock.mockResolvedValue({
      data: [{
        ...member,
        id: 'member-2',
        full_name: 'Missing Mailbox',
        lodge_email: null,
        mailbox_status: 'unprovisioned',
        mailbox_provisioned_at: null,
        mailbox_activated_at: null,
      }],
      error: null,
    });

    render(<LodgeEmailAccountsManager />);
    fireEvent.click(await screen.findByRole('tab', { name: /Personal Mailboxes/ }));

    expect(screen.getByText('1 roster member needs a personal Lodge mailbox.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Provision 1 Mailbox' })).toBeInTheDocument();
    expect(screen.getByText(/sends no bulk member email/i)).toBeInTheDocument();
  });

  it('requires confirmation and runs mailbox recovery without a notification request', async () => {
    const missingMember = {
      ...member,
      id: '28f31769-45d5-4dc3-b4bd-e1ce454a54ae',
      lodge_email: null,
      mailbox_status: 'unprovisioned' as const,
    };
    rpcMock.mockResolvedValue({ data: [missingMember], error: null });
    functionInvokeMock.mockResolvedValue({
      data: {
        results: [{ memberName: missingMember.full_name, ok: true }],
        notificationsSent: 0,
      },
      error: null,
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<LodgeEmailAccountsManager />);
    fireEvent.click(await screen.findByRole('tab', { name: /Personal Mailboxes/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Provision 1 Mailbox' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('does not send bulk member email'));
    await waitFor(() => expect(functionInvokeMock).toHaveBeenCalledWith(
      'provision-member-mailboxes',
      {
        body: {
          mode: 'run',
          confirmed: true,
          memberIds: [missingMember.id],
        },
      },
    ));
    expect(await screen.findByText('1 personal Lodge mailbox was provisioned. No member email was sent.'))
      .toBeInTheDocument();
    confirm.mockRestore();
  });

  it('shows mailbox details but no administrative actions to read-only managers', async () => {
    hasAdminPermissionMock.mockReturnValue(false);
    render(<LodgeEmailAccountsManager />);

    const secretary = await screen.findByRole('button', { name: 'Manage mailbox secretary@carpmasons.ca' });
    fireEvent.click(secretary);

    expect(screen.getByText('Credentials:')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Password Reset' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Details & History' })).not.toBeInTheDocument();
  });
});
