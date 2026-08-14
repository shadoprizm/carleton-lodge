import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { AdminLibraryPage } from './AdminLibraryPage';

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
          data: table === 'document_categories' ? [category] : [storedDocument],
          error: null,
        }),
      }),
    }),
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
  afterEach(() => cleanup());

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
});
