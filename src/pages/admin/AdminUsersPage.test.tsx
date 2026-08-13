import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '../../lib/supabase';
import type { AdminSectionPermission } from '../../lib/adminPermissions';
import { AdminUsersPage } from './AdminUsersPage';

const {
  fromMock,
  permissionDeleteInMock,
  permissionUpsertMock,
  profileUpdateEqMock,
  profileUpdateMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  permissionDeleteInMock: vi.fn(),
  permissionUpsertMock: vi.fn(),
  profileUpdateEqMock: vi.fn(),
  profileUpdateMock: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-1' } }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: { from: fromMock },
}));

const profiles: Profile[] = [
  {
    id: 'admin-1',
    email: 'admin@example.com',
    is_admin: true,
    force_password_change: false,
    created_at: '2026-01-03T12:00:00Z',
    updated_at: '2026-01-03T12:00:00Z',
  },
  {
    id: 'delegate-1',
    email: 'editor@example.com',
    is_admin: false,
    force_password_change: false,
    created_at: '2026-01-02T12:00:00Z',
    updated_at: '2026-01-02T12:00:00Z',
  },
  {
    id: 'member-1',
    email: 'member@example.com',
    is_admin: false,
    force_password_change: false,
    created_at: '2026-01-01T12:00:00Z',
    updated_at: '2026-01-01T12:00:00Z',
  },
];

const permissions: AdminSectionPermission[] = [
  {
    id: 'permission-1',
    profile_id: 'delegate-1',
    section: 'events',
    can_read: true,
    can_write: false,
    can_approve: true,
    granted_by: 'admin-1',
    created_at: '2026-01-02T12:00:00Z',
    updated_at: '2026-01-02T12:00:00Z',
  },
];

describe('AdminUsersPage', () => {
  beforeEach(() => {
    fromMock.mockReset();
    permissionDeleteInMock.mockReset();
    permissionUpsertMock.mockReset();
    profileUpdateEqMock.mockReset();
    profileUpdateMock.mockReset();

    permissionUpsertMock.mockResolvedValue({ error: null });
    permissionDeleteInMock.mockResolvedValue({ error: null });
    profileUpdateEqMock.mockResolvedValue({ error: null });
    profileUpdateMock.mockReturnValue({ eq: profileUpdateEqMock });

    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: profiles, error: null }),
          })),
          update: profileUpdateMock,
        };
      }

      if (table === 'admin_section_permissions') {
        return {
          select: vi.fn().mockResolvedValue({ data: permissions, error: null }),
          upsert: permissionUpsertMock,
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({ in: permissionDeleteInMock })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  afterEach(() => cleanup());

  it('starts with compact rows and keeps only one user expanded', async () => {
    render(<AdminUsersPage />);

    const editorButton = await screen.findByRole('button', {
      name: 'Manage access for editor@example.com',
    });
    const memberButton = screen.getByRole('button', {
      name: 'Manage access for member@example.com',
    });

    expect(editorButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Roster and officer records')).not.toBeInTheDocument();

    fireEvent.click(editorButton);
    expect(editorButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Roster and officer records')).toBeInTheDocument();

    fireEvent.click(memberButton);
    expect(editorButton).toHaveAttribute('aria-expanded', 'false');
    expect(memberButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('Roster and officer records')).toHaveLength(1);
  });

  it('searches and filters users by their saved access role', async () => {
    render(<AdminUsersPage />);
    await screen.findByText('editor@example.com');

    fireEvent.change(screen.getByLabelText('Filter users'), { target: { value: 'delegated' } });

    expect(screen.getByText('editor@example.com')).toBeInTheDocument();
    expect(screen.queryByText('admin@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('member@example.com')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 3 users')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search by email'), {
      target: { value: 'someone-else' },
    });
    expect(screen.getByText('No users match your search and filter.')).toBeInTheDocument();
  });

  it('stages section changes and saves them together', async () => {
    render(<AdminUsersPage />);
    fireEvent.click(await screen.findByRole('button', {
      name: 'Manage access for member@example.com',
    }));

    fireEvent.click(screen.getByRole('radio', { name: 'Edit Members' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Approve submissions' }));

    expect(permissionUpsertMock).not.toHaveBeenCalled();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(permissionUpsertMock).toHaveBeenCalledTimes(1));
    expect(permissionUpsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          profile_id: 'member-1',
          section: 'members',
          can_read: true,
          can_write: true,
          can_approve: false,
        }),
        expect.objectContaining({
          profile_id: 'member-1',
          section: 'events',
          can_read: true,
          can_write: false,
          can_approve: true,
        }),
      ]),
      { onConflict: 'profile_id,section' }
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Access changes saved.');
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
    expect(profileUpdateMock).not.toHaveBeenCalled();
  });

  it('removes an existing section permission when access is set to none', async () => {
    render(<AdminUsersPage />);
    fireEvent.click(await screen.findByRole('button', {
      name: 'Manage access for editor@example.com',
    }));

    fireEvent.click(screen.getByRole('radio', { name: 'None Events' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(permissionDeleteInMock).toHaveBeenCalledWith('section', ['events']);
    });
    expect(permissionUpsertMock).not.toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('Access changes saved.');
  });

  it('requires confirmation before granting full administrator access', async () => {
    render(<AdminUsersPage />);
    fireEvent.click(await screen.findByRole('button', {
      name: 'Manage access for member@example.com',
    }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'Full administrator access' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByText('Grant full administrator access?')).toBeInTheDocument();
    expect(profileUpdateMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save' }));

    await waitFor(() => {
      expect(profileUpdateMock).toHaveBeenCalledWith({ is_admin: true });
      expect(profileUpdateEqMock).toHaveBeenCalledWith('id', 'member-1');
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Access changes saved.');
  });

  it('shows a save error and retains the staged selection', async () => {
    permissionUpsertMock.mockResolvedValue({
      error: { message: 'Permission update was rejected.' },
    });

    render(<AdminUsersPage />);
    fireEvent.click(await screen.findByRole('button', {
      name: 'Manage access for member@example.com',
    }));
    fireEvent.click(screen.getByRole('radio', { name: 'View Gallery' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Permission update was rejected.');
    expect(screen.getByRole('radio', { name: 'View Gallery' })).toBeChecked();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('protects the current administrator from changing their own full access', async () => {
    render(<AdminUsersPage />);
    fireEvent.click(await screen.findByRole('button', {
      name: 'Manage access for admin@example.com',
    }));

    expect(screen.getByRole('checkbox', { name: 'Full administrator access' })).toBeDisabled();
    expect(screen.getByText('You cannot remove your own full-administrator access here.')).toBeInTheDocument();
  });
});
