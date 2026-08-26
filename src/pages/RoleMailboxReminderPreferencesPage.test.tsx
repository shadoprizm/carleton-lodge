import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoleMailboxReminderPreferencesPage } from './RoleMailboxReminderPreferencesPage';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('../lib/supabase', () => ({
  supabase: { functions: { invoke } },
}));

const validToken = 'a'.repeat(43);

describe('RoleMailboxReminderPreferencesPage', () => {
  beforeEach(() => {
    invoke.mockReset();
    window.history.replaceState(null, '', '/email-reminders');
  });

  it('requires confirmation before stopping reminders', async () => {
    window.location.hash = `token=${validToken}`;
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    render(<MemoryRouter><RoleMailboxReminderPreferencesPage /></MemoryRouter>);

    expect(invoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stop these reminders' }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith(
      'manage-role-mailbox-reminders',
      { body: { token: validToken } },
    ));
    expect(await screen.findByRole('heading', { name: 'Reminders stopped' })).toBeInTheDocument();
  });

  it('does not submit when the private token is missing', () => {
    render(<MemoryRouter><RoleMailboxReminderPreferencesPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'This reminder link is unavailable' })).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });
});
