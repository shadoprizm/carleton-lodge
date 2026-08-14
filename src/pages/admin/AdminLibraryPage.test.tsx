import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { AdminLibraryPage } from './AdminLibraryPage';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

const category = {
  id: 'category-1',
  name: 'Agendas',
  description: null,
  display_order: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const storedDocument = {
  id: 'document-1',
  category_id: category.id,
  summons_id: null,
  display_order: 0,
  title: 'Stored Agenda',
  description: null,
  file_url: 'stored-agenda.pdf',
  file_name: 'stored-agenda.pdf',
  file_size: 100,
  file_type: 'application/pdf',
  storage_bucket: 'lodge-documents',
  tags: [],
  uploaded_by: 'admin-1',
  source_issuer: null,
  source_url: null,
  rights_reviewed: true,
  include_in_lodge_guide: false,
  source_mailroom_import_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  document_categories: category,
};

const olderDocument = {
  ...storedDocument,
  id: 'document-2',
  title: 'Older Agenda',
  file_url: 'older-agenda.pdf',
  file_name: 'older-agenda.pdf',
  display_order: 1,
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1' },
    hasAdminPermission: () => true,
  }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        order: () => Promise.resolve({
          data: table === 'document_categories' ? [category] : [storedDocument, olderDocument],
          error: null,
        }),
      }),
    }),
    rpc: rpcMock,
    storage: {
      from: () => ({ createSignedUrl: vi.fn() }),
    },
  },
}));

vi.mock('../../components/DocumentPreviewModal', () => ({
  DocumentPreviewModal: ({ doc, localFile, onClose }: {
    doc: typeof storedDocument | null;
    localFile?: File | null;
    onClose: () => void;
  }) => {
    if (!doc && !localFile) return null;
    return (
      <div role="dialog" aria-label="Document preview">
        <span>{doc?.title ?? localFile?.name}</span>
        <button type="button" onClick={onClose}>Close preview</button>
      </div>
    );
  },
}));

describe('AdminLibraryPage previews', () => {
  afterEach(() => {
    cleanup();
    rpcMock.mockClear();
  });

  const renderPage = () => render(
    <MemoryRouter>
      <AdminLibraryPage />
    </MemoryRouter>,
  );

  it('previews stored documents and a file selected for single upload', async () => {
    const view = renderPage();
    await screen.findByText('Stored Agenda');

    fireEvent.click(screen.getByRole('button', { name: 'Preview Stored Agenda' }));
    expect(screen.getByRole('dialog', { name: 'Document preview' })).toHaveTextContent('Stored Agenda');
    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));

    fireEvent.click(screen.getByRole('button', { name: 'Upload Document' }));
    const fileInput = view.container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput!, {
      target: { files: [new File(['pdf'], 'Local agenda.pdf', { type: 'application/pdf' })] },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Preview selected file' }));
    expect(screen.getByRole('dialog', { name: 'Document preview' })).toHaveTextContent('Local agenda.pdf');
  });

  it('previews individual files in the bulk upload queue', async () => {
    const view = renderPage();
    await screen.findByText('Stored Agenda');
    fireEvent.click(screen.getByRole('button', { name: 'Bulk Upload' }));

    const fileInput = view.container.querySelector<HTMLInputElement>('input[type="file"][multiple]');
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput!, {
      target: { files: [new File(['pdf'], 'Bulk notice.pdf', { type: 'application/pdf' })] },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Preview Bulk notice.pdf' }));
    expect(screen.getByRole('dialog', { name: 'Document preview' })).toHaveTextContent('Bulk notice.pdf');
  });

  it('persists a manual document order for the whole category', async () => {
    renderPage();
    await screen.findByText('Stored Agenda');

    fireEvent.click(screen.getByRole('button', { name: 'Move Stored Agenda down' }));

    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith(
      'reorder_library_documents',
      {
        target_category_id: category.id,
        ordered_document_ids: ['document-2', 'document-1'],
      },
    ));

    expect(screen.getAllByRole('button', { name: /^Preview / }).map((button) => (
      button.getAttribute('aria-label')
    ))).toEqual(['Preview Older Agenda', 'Preview Stored Agenda']);
  });
});
