import { describe, expect, it } from 'vitest';
import {
  buildOfficeViewerUrl,
  getDocumentFileTypeLabel,
  getDocumentFormat,
  resolveDocumentMimeType,
  validateDocumentUpload,
} from './documentFiles';

describe('document file handling', () => {
  it('recognizes PowerPoint files by MIME type and extension', () => {
    expect(getDocumentFormat('Lodge education.pptx', '')).toBe('presentation');
    expect(getDocumentFormat('Lodge education.ppt', 'application/vnd.ms-powerpoint'))
      .toBe('presentation');
    expect(getDocumentFileTypeLabel('Lodge education.pptx', null)).toBe('PPTX');
  });

  it('supplies a storage-safe MIME type when the browser omits it', () => {
    expect(resolveDocumentMimeType('budget.xlsx', '')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(resolveDocumentMimeType('slides.pptx', 'application/octet-stream')).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
    expect(resolveDocumentMimeType('roster.csv', 'text/csv')).toBe('text/plain');
  });

  it('builds an encoded Microsoft Office viewer URL', () => {
    const signedUrl = 'https://example.supabase.co/file.pptx?token=abc&download=1';
    expect(buildOfficeViewerUrl(signedUrl)).toBe(
      `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signedUrl)}`,
    );
  });

  it('rejects unsupported files and files over the server upload limit', () => {
    expect(validateDocumentUpload({ name: 'program.exe', size: 10, type: '' }))
      .toContain('not a supported document type');
    expect(validateDocumentUpload({ name: 'large.pdf', size: 25 * 1024 * 1024 + 1, type: 'application/pdf' }))
      .toContain('25 MB');
  });
});
