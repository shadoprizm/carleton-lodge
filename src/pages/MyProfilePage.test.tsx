import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import type { MyMemberProfile } from '../lib/supabase';
import { MyProfilePage } from './MyProfilePage';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

const memberProfile: MyMemberProfile = {
  id: 'member-1',
  full_name: 'Bro. Example Member',
  phone: '613-555-0100',
  address: '1 Lodge Lane\nCarp, ON',
  join_date: '2020-01-04',
  position_id: null,
  position_name: null,
  bio: 'A helpful Lodge member.',
  visible_to_members: false,
  lodge_email: 'example@carpmasons.ca',
  mailbox_status: 'active',
  grand_lodge_membership_number: 'GL-00465',
  created_at: '2020-01-04T12:00:00Z',
  updated_at: '2026-08-10T12:00:00Z',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <MyProfilePage />
    </MemoryRouter>,
  );
}

describe('MyProfilePage', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  afterEach(() => cleanup());

  it('loads the linked member profile including private self-only details', async () => {
    rpcMock.mockResolvedValueOnce({ data: [memberProfile], error: null });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Bro. Example Member' })).toBeInTheDocument();
    expect(screen.getByText('GL-00465')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/1 Lodge Lane/)).toBeInTheDocument();
    expect(screen.getByText('Hidden from the member directory')).toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith('get_my_member_profile');
  });

  it('saves only phone, address, and biography and refreshes the form', async () => {
    const updatedProfile = {
      ...memberProfile,
      phone: '613-555-0199',
      address: null,
      bio: 'Updated biography.',
    };
    rpcMock
      .mockResolvedValueOnce({ data: [memberProfile], error: null })
      .mockResolvedValueOnce({ data: [updatedProfile], error: null });

    renderPage();
    await screen.findByRole('heading', { name: 'Bro. Example Member' });

    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '613-555-0199' } });
    fireEvent.change(screen.getByLabelText('Home address'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Biography'), { target: { value: 'Updated biography.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(rpcMock).toHaveBeenNthCalledWith(2, 'update_my_member_profile', {
      new_phone: '613-555-0199',
      new_address: '',
      new_bio: 'Updated biography.',
    }));
    expect(await screen.findByText('Your member profile has been updated.')).toBeInTheDocument();
    expect(screen.getByLabelText('Home address')).toHaveValue('');
    expect(screen.getByLabelText('Phone number')).toHaveValue('613-555-0199');
  });

  it('keeps the form open and presents server validation errors', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: [memberProfile], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'Biography must be 2000 characters or fewer' } });

    renderPage();
    await screen.findByRole('heading', { name: 'Bro. Example Member' });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Biography must be 2000 characters or fewer');
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeEnabled();
  });

  it('shows a support path when the login has no linked roster record', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Connect your member profile' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ask for profile help' })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:support@carpmasons.ca'),
    );
  });
});
