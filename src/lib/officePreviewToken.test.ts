import { describe, expect, it } from 'vitest';
import {
  buildOfficePreviewProxyUrl,
  createOfficePreviewToken,
  getOfficePreviewTokenFromUrl,
  verifyOfficePreviewToken,
} from '../../supabase/functions/_shared/office-preview-token';

const DOCUMENT_ID = '5d60a0df-7928-4dfb-a72f-e25896b974ac';
const SECRET = 'test-service-role-secret';
const NOW = 1_786_827_000;

describe('office preview tokens', () => {
  it('builds the canonical public Edge Function URL', () => {
    const previewUrl = buildOfficePreviewProxyUrl(
      'https://project.supabase.co/',
      'compact-token',
      'Budget 2025.docx',
    );

    expect(previewUrl)
      .toBe(
        'https://project.supabase.co/functions/v1/office-document-preview/compact-token/Budget%202025.docx',
      );
    expect(getOfficePreviewTokenFromUrl(previewUrl)).toBe('compact-token');
    expect(getOfficePreviewTokenFromUrl(
      'https://project.supabase.co/functions/v1/office-document-preview?token=legacy-token',
    )).toBe('legacy-token');
  });

  it('round-trips a document id in a compact token', async () => {
    const token = await createOfficePreviewToken(DOCUMENT_ID, NOW + 900, SECRET);

    expect(token.length).toBeLessThan(64);
    await expect(verifyOfficePreviewToken(token, SECRET, NOW)).resolves.toEqual({
      documentId: DOCUMENT_ID,
      expiresAtSeconds: NOW + 900,
    });
  });

  it('rejects tampered, expired, and overlong tokens', async () => {
    const valid = await createOfficePreviewToken(DOCUMENT_ID, NOW + 900, SECRET);
    const tampered = `${valid.slice(0, -1)}${valid.endsWith('A') ? 'B' : 'A'}`;
    const expired = await createOfficePreviewToken(DOCUMENT_ID, NOW - 1, SECRET);
    const overlong = await createOfficePreviewToken(DOCUMENT_ID, NOW + 1_201, SECRET);

    await expect(verifyOfficePreviewToken(tampered, SECRET, NOW)).resolves.toBeNull();
    await expect(verifyOfficePreviewToken(expired, SECRET, NOW)).resolves.toBeNull();
    await expect(verifyOfficePreviewToken(overlong, SECRET, NOW)).resolves.toBeNull();
  });
});
