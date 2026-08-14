import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

    expect(await screen.findByText('Office documents cannot be previewed inline')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open in new tab' })).toHaveAttribute('href', 'blob:local-preview');
    expect(createSignedUrlMock).not.toHaveBeenCalled();
  });
});
