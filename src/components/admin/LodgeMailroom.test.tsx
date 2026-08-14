import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboundEmail, TrustedEmailSender } from '../../lib/supabase';
import { LodgeMailroom } from './LodgeMailroom';

const {
  fromMock,
  hasAdminPermissionMock,
  senderDeleteEqMock,
  senderUpdateEqMock,
  senderUpdateMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  hasAdminPermissionMock: vi.fn(),
  senderDeleteEqMock: vi.fn(),
  senderUpdateEqMock: vi.fn(),
  senderUpdateMock: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1' },
    hasAdminPermission: hasAdminPermissionMock,
  }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: fromMock,
    functions: { invoke: vi.fn() },
  },
}));

const inactiveSender: TrustedEmailSender = {
  id: 'sender-1',
  email: 'ratelle.ja@gmail.com',
  label: 'Shadow test — Jeramy Ratelle',
  is_active: false,
  created_by: 'admin-1',
  created_at: '2026-08-11T01:48:23Z',
  updated_at: '2026-08-11T02:10:00Z',
};

const inboundMessage: InboundEmail = {
  id: 'message-1',
  provider: 'resend',
  provider_message_id: 'provider-message-1',
  from_address: 'secretary@example.com',
  to_addresses: ['mailroom@inbound.carpmasons.ca'],
  cc_addresses: [],
  received_for_addresses: ['mailroom@inbound.carpmasons.ca'],
  subject: 'September summons',
  text_body: 'Example message body',
  html_body: null,
  headers: {},
  attachments: [],
  raw_payload: {},
  message_sha256: 'hash',
  retention_until: '2027-08-13T18:00:00Z',
  purge_claimed_at: null,
  content_purged_at: null,
  processing_status: 'received',
  received_at: '2026-08-13T18:00:00Z',
  processed_at: null,
  last_error: null,
  created_at: '2026-08-13T18:00:00Z',
  updated_at: '2026-08-13T18:00:00Z',
};

const limitedOrderedResult = (data: unknown[]) => ({
  select: vi.fn(() => ({
    order: vi.fn(() => ({
      limit: vi.fn().mockResolvedValue({ data, error: null }),
    })),
  })),
});

describe('LodgeMailroom compact history and trusted senders', () => {
  beforeEach(() => {
    fromMock.mockReset();
    hasAdminPermissionMock.mockReturnValue(true);
    senderDeleteEqMock.mockReset().mockResolvedValue({ error: null });
    senderUpdateEqMock.mockReset().mockResolvedValue({ error: null });
    senderUpdateMock.mockReset().mockReturnValue({ eq: senderUpdateEqMock });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    fromMock.mockImplementation((table: string) => {
      if (table === 'inbound_emails') return limitedOrderedResult([inboundMessage]);
      if (table === 'mailroom_imports') return limitedOrderedResult([]);
      if (table === 'trusted_email_senders') {
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: [inactiveSender], error: null }),
          })),
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: senderUpdateMock,
          delete: vi.fn(() => ({ eq: senderDeleteEqMock })),
        };
      }
      if (table === 'district_lodges') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('starts inbound notifications minimized and expands the message history', async () => {
    render(<MemoryRouter><LodgeMailroom /></MemoryRouter>);

    const toggle = await screen.findByRole('button', { name: 'Expand inbound notifications' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('1 recent message')).toBeInTheDocument();
    expect(screen.queryByText('September summons')).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'Collapse inbound notifications' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('September summons')).toBeInTheDocument();
  });

  it('explains inactive senders and lets a writer edit or remove them', async () => {
    render(<MemoryRouter><LodgeMailroom /></MemoryRouter>);

    expect(await screen.findByText('Shadow test — Jeramy Ratelle')).toBeInTheDocument();
    expect(screen.getByText(/Inactive entries are retained for reference/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activate trusted sender Shadow test — Jeramy Ratelle' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit trusted sender Shadow test — Jeramy Ratelle' }));
    const editForm = screen.getByRole('button', { name: 'Save changes' }).closest('form');
    expect(editForm).not.toBeNull();
    fireEvent.change(within(editForm!).getByLabelText('Role or label'), { target: { value: 'Website administrator' } });
    fireEvent.change(within(editForm!).getByLabelText('Email address'), { target: { value: 'ADMIN@EXAMPLE.COM' } });
    fireEvent.submit(editForm!);

    await waitFor(() => {
      expect(senderUpdateMock).toHaveBeenCalledWith({
        email: 'admin@example.com',
        label: 'Website administrator',
      });
      expect(senderUpdateEqMock).toHaveBeenCalledWith('id', inactiveSender.id);
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Remove trusted sender Shadow test — Jeramy Ratelle' }));

    await waitFor(() => expect(senderDeleteEqMock).toHaveBeenCalledWith('id', inactiveSender.id));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Existing Mailroom records will not be deleted.'));
  });
});
