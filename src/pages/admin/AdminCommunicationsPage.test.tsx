import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationOutboxItem } from '../../lib/supabase';
import { AdminCommunicationsPage } from './AdminCommunicationsPage';

const { fromMock, hasAdminPermissionMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  hasAdminPermissionMock: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ hasAdminPermission: hasAdminPermissionMock }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: fromMock,
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('../../components/admin/AnnouncementsManager', () => ({
  AnnouncementsManager: () => <div>Announcements manager</div>,
}));

vi.mock('../../components/admin/LodgeMailroom', () => ({
  LodgeMailroom: () => <div>Lodge mailroom</div>,
}));

const outboundMessage: NotificationOutboxItem = {
  id: 'notification-1',
  channel: 'email',
  notification_type: 'event_submission_approved',
  recipient_profile_id: null,
  recipient_email: 'member@example.com',
  payload: {},
  status: 'sent',
  provider: 'resend',
  provider_message_id: 'provider-1',
  idempotency_key: 'notification-1',
  attempt_count: 1,
  max_attempts: 5,
  available_at: '2026-08-13T18:00:00Z',
  locked_at: null,
  sent_at: '2026-08-13T18:01:00Z',
  last_error: null,
  created_at: '2026-08-13T18:00:00Z',
  updated_at: '2026-08-13T18:01:00Z',
};

describe('AdminCommunicationsPage notification history', () => {
  beforeEach(() => {
    fromMock.mockReset();
    hasAdminPermissionMock.mockReturnValue(true);
    fromMock.mockReturnValue({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({ data: [outboundMessage], error: null }),
        })),
      })),
    });
  });

  afterEach(() => cleanup());

  it('starts outbound notifications minimized and expands them on request', async () => {
    render(<AdminCommunicationsPage />);

    const toggle = await screen.findByRole('button', { name: 'Expand outbound notifications' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('1 recent notification')).toBeInTheDocument();
    expect(screen.queryByText('member@example.com')).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'Collapse outbound notifications' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('member@example.com')).toBeInTheDocument();
  });
});
