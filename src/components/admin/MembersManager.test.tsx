import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LodgeMemberWithPosition } from '../../lib/supabase';
import { MembersManager } from './MembersManager';

const {
  fromMock,
  functionInvokeMock,
  hasAdminPermissionMock,
  rpcMock,
  updateEqMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  functionInvokeMock: vi.fn(),
  hasAdminPermissionMock: vi.fn(),
  rpcMock: vi.fn(),
  updateEqMock: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    hasAdminPermission: hasAdminPermissionMock,
  }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: fromMock,
    functions: { invoke: functionInvokeMock },
    rpc: rpcMock,
  },
}));

const managedMember: LodgeMemberWithPosition = {
  id: 'member-1',
  full_name: 'Example Member',
  email: 'member@example.com',
  phone: '613-555-0100',
  address: '1 Lodge Lane',
  grand_lodge_membership_number: 'GL-00465',
  join_date: '2020-01-04',
  position_id: null,
  bio: 'Example biography',
  visible_to_members: true,
  linked_profile_id: 'profile-1',
  lodge_email: 'example@carpmasons.ca',
  mailbox_status: 'active',
  mailbox_quota_mb: 250,
  mailbox_send_limit: 100,
  mailbox_provisioned_at: '2026-08-01T12:00:00Z',
  mailbox_activated_at: '2026-08-02T12:00:00Z',
  created_at: '2020-01-04T12:00:00Z',
  updated_at: '2026-08-10T12:00:00Z',
  lodge_positions: null,
};

const deletionTestMember: LodgeMemberWithPosition = {
  ...managedMember,
  id: '28f31769-45d5-4dc3-b4bd-e1ce454a54ae',
  full_name: 'Test',
  email: 'ratelle@icloud.com',
  grand_lodge_membership_number: null,
  linked_profile_id: '0ff3906c-999f-467d-8b2e-1b557e096e8b',
  lodge_email: 'test@carpmasons.ca',
  mailbox_status: 'pending_activation',
};

const secondManagedMember: LodgeMemberWithPosition = {
  ...managedMember,
  id: 'member-2',
  full_name: 'Second Member',
  email: 'second@example.com',
  phone: null,
  address: null,
  grand_lodge_membership_number: 'GL-00466',
  bio: 'Second biography',
  linked_profile_id: null,
  lodge_email: null,
  mailbox_status: 'unprovisioned',
};

function orderedResult(data: unknown[]) {
  return {
    select: vi.fn(() => ({
      order: vi.fn().mockResolvedValue({ data, error: null }),
    })),
  };
}

describe('MembersManager Grand Lodge membership number', () => {
  beforeEach(() => {
    fromMock.mockReset();
    functionInvokeMock.mockReset();
    hasAdminPermissionMock.mockReset();
    rpcMock.mockReset();
    updateEqMock.mockReset();

    rpcMock.mockResolvedValue({ data: [managedMember], error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === 'lodge_positions') return orderedResult([]);
      if (table === 'profiles') return orderedResult([{ id: 'profile-1', email: 'member@example.com' }]);
      if (table === 'lodge_members') {
        return {
          update: vi.fn(() => ({ eq: updateEqMock })),
          insert: vi.fn(),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  afterEach(() => cleanup());

  it('shows the number to a read-only roster manager without edit controls', async () => {
    hasAdminPermissionMock.mockReturnValue(false);

    render(<MembersManager />);
    fireEvent.click(screen.getByRole('button', { name: /Regular Members/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Manage roster entry for Example Member' }));

    expect(await screen.findByText('GL-00465')).toBeInTheDocument();
    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument();
  });

  it('keeps the edit form open when a duplicate number is rejected', async () => {
    hasAdminPermissionMock.mockReturnValue(true);
    updateEqMock.mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "lodge_members_grand_lodge_number_unique_idx"',
      },
    });

    render(<MembersManager />);
    fireEvent.click(screen.getByRole('button', { name: /Regular Members/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Manage roster entry for Example Member' }));
    fireEvent.click(await screen.findByTitle('Edit'));

    const numberInput = screen.getByLabelText(/Grand Lodge Membership Number/);
    fireEvent.change(numberInput, { target: { value: 'GL-DUPLICATE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already assigned to another roster record');
    expect(screen.getByLabelText(/Grand Lodge Membership Number/)).toHaveValue('GL-DUPLICATE');
  });

  it('keeps roster actions collapsed, opens one member at a time, and filters the list', async () => {
    hasAdminPermissionMock.mockReturnValue(true);
    rpcMock.mockResolvedValue({ data: [managedMember, secondManagedMember], error: null });

    render(<MembersManager />);
    fireEvent.click(screen.getByRole('button', { name: /Regular Members/ }));

    const firstMember = await screen.findByRole('button', { name: 'Manage roster entry for Example Member' });
    const secondMember = screen.getByRole('button', { name: 'Manage roster entry for Second Member' });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(firstMember).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Delete Example Member' })).not.toBeInTheDocument();

    fireEvent.click(firstMember);
    expect(firstMember).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Delete Example Member' })).toBeInTheDocument();

    fireEvent.click(secondMember);
    expect(firstMember).toHaveAttribute('aria-expanded', 'false');
    expect(secondMember).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByText('Example biography')).not.toBeInTheDocument();
    expect(screen.getByText('Second biography')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search roster'), { target: { value: 'GL-00465' } });
    expect(screen.getByText('Showing 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage roster entry for Example Member' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage roster entry for Second Member' })).not.toBeInTheDocument();
  });
});

describe('MembersManager member deletion', () => {
  beforeEach(() => {
    fromMock.mockReset();
    functionInvokeMock.mockReset();
    hasAdminPermissionMock.mockReset();
    rpcMock.mockReset();
    updateEqMock.mockReset();

    hasAdminPermissionMock.mockReturnValue(true);
    rpcMock.mockResolvedValue({ data: [deletionTestMember], error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === 'lodge_positions' || table === 'profiles') return orderedResult([]);
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  afterEach(() => cleanup());

  const renderDeletionTestMember = async () => {
    render(<MembersManager />);
    fireEvent.click(await screen.findByRole('button', { name: /Regular Members/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Manage roster entry for Test' }));
  };

  it('opens an in-page confirmation before invoking deletion', async () => {
    const nativeConfirm = vi.spyOn(window, 'confirm');
    functionInvokeMock.mockResolvedValue({ data: { deleted: true }, error: null });
    await renderDeletionTestMember();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Test' }));

    const dialog = screen.getByRole('dialog', { name: 'Permanently delete member?' });
    expect(dialog).toHaveTextContent('test@carpmasons.ca Lodge mailbox');
    expect(screen.getByRole('checkbox', { name: /all email stored in that mailbox/i })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Permanently Delete' })).toBeDisabled();
    expect(functionInvokeMock).not.toHaveBeenCalled();
    expect(nativeConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    nativeConfirm.mockRestore();
  });

  it('requires mailbox-content consent and keeps a deletion blocker beside the member action', async () => {
    const blocker = "Complete or cancel this member's active officer-mailbox assignment before deleting the member.";
    functionInvokeMock.mockResolvedValue({
      data: null,
      error: {
        context: new Response(JSON.stringify({ error: blocker }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }),
      },
    });
    await renderDeletionTestMember();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Test' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /all email stored in that mailbox/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Permanently Delete' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(blocker);
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(functionInvokeMock).toHaveBeenCalledWith('delete-member', {
      body: {
        memberId: deletionTestMember.id,
        confirmed: true,
        deleteMailboxContents: true,
      },
    });
  });
});
