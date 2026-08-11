import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LodgeMemberWithPosition } from '../../lib/supabase';
import { MembersManager } from './MembersManager';

const { fromMock, hasAdminPermissionMock, rpcMock, updateEqMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
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
    fireEvent.click(await screen.findByTitle('Edit'));

    const numberInput = screen.getByLabelText(/Grand Lodge Membership Number/);
    fireEvent.change(numberInput, { target: { value: 'GL-DUPLICATE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already assigned to another roster record');
    expect(screen.getByLabelText(/Grand Lodge Membership Number/)).toHaveValue('GL-DUPLICATE');
  });
});
