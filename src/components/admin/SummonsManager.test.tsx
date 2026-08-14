import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SummonsManager } from './SummonsManager';

const { fromMock, insertMock, storageUploadMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  insertMock: vi.fn(),
  storageUploadMock: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1' },
    hasAdminPermission: () => true,
  }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: fromMock,
    storage: {
      from: () => ({
        upload: storageUploadMock,
        createSignedUrl: vi.fn(),
      }),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

describe('SummonsManager publishing', () => {
  beforeEach(() => {
    insertMock.mockReset().mockResolvedValue({ data: null, error: null });
    storageUploadMock.mockReset().mockResolvedValue({ data: null, error: null });
    fromMock.mockReset().mockImplementation((table: string) => {
      if (table !== 'summons') throw new Error(`Unexpected table: ${table}`);
      return {
        select: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
        insert: insertMock,
      };
    });
  });

  afterEach(() => cleanup());

  const openUploadForm = async () => {
    const { container } = render(<SummonsManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Post New Summons' }));

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput!, {
      target: {
        files: [new File(['pdf'], 'Carleton Lodge January 1904.pdf', { type: 'application/pdf' })],
      },
    });

    return screen.findByRole('checkbox', { name: /Email members when this is published/i });
  };

  it('publishes historical summons without notifying by default', async () => {
    const notifyCheckbox = await openUploadForm();

    expect(notifyCheckbox).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      notify_members: false,
      file_name: 'Carleton Lodge January 1904.pdf',
      file_type: 'application/pdf',
    }));
  });

  it('only notifies when the administrator explicitly opts in', async () => {
    const notifyCheckbox = await openUploadForm();
    fireEvent.click(notifyCheckbox);

    fireEvent.click(screen.getByRole('button', { name: 'Publish & Notify Members' }));

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      notify_members: true,
    }));
  });
});
