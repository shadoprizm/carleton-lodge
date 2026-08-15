import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentWithCategory } from '../lib/supabase';
import { DocumentPreviewModal } from './DocumentPreviewModal';

const { createSignedUrlMock } = vi.hoisted(() => ({
  createSignedUrlMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({ createSignedUrl: createSignedUrlMock }),
    },
  },
}));

describe('DocumentPreviewModal local files', () => {
  const createObjectUrlMock = vi.fn(() => 'blob:local-preview');
  const revokeObjectUrlMock = vi.fn();

  beforeEach(() => {
    createSignedUrlMock.mockReset();
    createObjectUrlMock.mockClear();
    revokeObjectUrlMock.mockClear();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: createObjectUrlMock,
      revokeObjectURL: revokeObjectUrlMock,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('previews a selected PDF without uploading or requesting a signed URL', async () => {
    const file = new File(['pdf'], 'January notice.pdf', { type: 'application/pdf' });
    const view = render(
      <DocumentPreviewModal doc={null} localFile={file} onClose={vi.fn()} />,
    );

    const frame = await screen.findByTitle('January notice.pdf');
    expect(frame).toHaveAttribute('src', 'blob:local-preview');
    expect(createSignedUrlMock).not.toHaveBeenCalled();

    view.unmount();
    await waitFor(() => expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:local-preview'));
  });

  it('recognizes Office files from their extension when the browser omits the MIME type', async () => {
    const file = new File(['docx'], 'Secretary report.docx');
    render(<DocumentPreviewModal doc={null} localFile={file} onClose={vi.fn()} />);

    expect(await screen.findByText('Upload this file to enable its Office preview')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open selected file' })).toHaveAttribute('href', 'blob:local-preview');
    expect(createSignedUrlMock).not.toHaveBeenCalled();
  });

  it('loads a stored PowerPoint inside the Microsoft Office viewer', async () => {
    createSignedUrlMock.mockResolvedValue({
      data: {
        signedUrl: 'https://example.supabase.co/storage/slides.pptx?token=temporary',
      },
      error: null,
    });
    const presentation: DocumentWithCategory = {
      id: 'document-1',
      category_id: null,
      summons_id: null,
      display_order: 0,
      title: 'Lodge education presentation',
      description: 'An educational slide deck',
      file_url: 'education/slides.pptx',
      file_name: 'slides.pptx',
      file_size: 2048,
      file_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      storage_bucket: 'lodge-documents',
      tags: [],
      uploaded_by: 'admin-1',
      source_issuer: null,
      source_url: null,
      rights_reviewed: false,
      include_in_lodge_guide: false,
      source_mailroom_import_id: null,
      created_at: '2026-08-15T12:00:00.000Z',
      updated_at: '2026-08-15T12:00:00.000Z',
      document_categories: null,
    };

    render(
      <DocumentPreviewModal
        doc={presentation}
        onClose={vi.fn()}
        onDownload={vi.fn()}
      />,
    );

    const iframe = await screen.findByTitle('Lodge education presentation preview');
    const source = iframe.getAttribute('src');

    expect(source).toContain('https://view.officeapps.live.com/op/embed.aspx?src=');
    expect(decodeURIComponent(source?.split('?src=')[1] ?? '')).toContain('token=temporary');
    expect(iframe).toHaveAttribute('credentialless');
    expect(createSignedUrlMock).toHaveBeenCalledWith('education/slides.pptx', 900);
    expect(screen.getByText(/temporary view-only link/i)).toBeInTheDocument();
  });
});
