import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MembersManager } from './MembersManager';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  invoke: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mocks.from,
    functions: { invoke: mocks.invoke },
    rpc: mocks.rpc,
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    hasAdminPermission: () => true,
  }),
}));

const testMember = {
  id: '28f31769-45d5-4dc3-b4bd-e1ce454a54ae',
  full_name: 'Test',
  email: 'ratelle@icloud.com',
  phone: null,
  address: null,
  join_date: null,
  position_id: null,
  bio: null,
  visible_to_members: true,
  linked_profile_id: '0ff3906c-999f-467d-8b2e-1b557e096e8b',
  lodge_email: 'test@carpmasons.ca',
  mailbox_status: 'pending_activation',
  mailbox_quota_mb: 500,
  mailbox_send_limit: 200,
  mailbox_provisioned_at: '2026-08-10T19:00:00.000Z',
  mailbox_activated_at: null,
  created_at: '2026-08-10T19:00:00.000Z',
  updated_at: '2026-08-10T19:07:48.000Z',
};

const renderMemberManager = async () => {
  render(<MembersManager />);
  const regularMembers = await screen.findByRole('button', { name: 'Regular Members1' });
  fireEvent.click(regularMembers);
};

describe('MembersManager member deletion', () => {
  beforeEach(() => {
    mocks.rpc.mockResolvedValue({ data: [testMember], error: null });
    mocks.from.mockImplementation((table: string) => ({
      select: () => ({
        order: () => Promise.resolve({
          data: table === 'lodge_positions' || table === 'profiles' ? [] : null,
          error: null,
        }),
      }),
    }));
    mocks.invoke.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('opens an in-page confirmation before invoking deletion', async () => {
    const nativeConfirm = vi.spyOn(window, 'confirm');
    mocks.invoke.mockResolvedValue({ data: { deleted: true }, error: null });
    await renderMemberManager();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Test' }));

    const dialog = screen.getByRole('dialog', { name: 'Permanently delete member?' });
    expect(dialog.textContent).toContain('test@carpmasons.ca Lodge mailbox');
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(nativeConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps a deletion blocker beside the member action', async () => {
    const blocker = 'This Lodge mailbox contains mail activity (0.012 MB stored) and cannot be hard-deleted.';
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        context: new Response(JSON.stringify({ error: blocker }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }),
      },
    });
    await renderMemberManager();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Test' }));
    fireEvent.click(screen.getByRole('button', { name: 'Permanently Delete' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(blocker);
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Lodge Email' }).getAttribute('href')).toBe('/admin/email-accounts');
    expect(mocks.invoke).toHaveBeenCalledWith('delete-member', {
      body: { memberId: testMember.id, confirmed: true },
    });
  });
});
