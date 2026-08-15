export type DocumentFormat =
  | 'pdf'
  | 'word'
  | 'spreadsheet'
  | 'presentation'
  | 'text'
  | 'image'
  | 'other';

export const DOCUMENT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/plain',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

const FORMAT_BY_EXTENSION: Record<string, DocumentFormat> = {
  pdf: 'pdf',
  doc: 'word',
  docx: 'word',
  xls: 'spreadsheet',
  xlsx: 'spreadsheet',
  ppt: 'presentation',
  pptx: 'presentation',
  txt: 'text',
  csv: 'text',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  webp: 'image',
  gif: 'image',
};

const FORMAT_BY_MIME_TYPE: Record<string, DocumentFormat> = Object.fromEntries(
  Object.entries(MIME_TYPE_BY_EXTENSION).map(([extension, mimeType]) => [
    mimeType,
    FORMAT_BY_EXTENSION[extension],
  ]),
);

const LABEL_BY_EXTENSION: Record<string, string> = {
  jpeg: 'JPG',
};

export const DOCUMENT_UPLOAD_ACCEPT = Object.keys(MIME_TYPE_BY_EXTENSION)
  .map((extension) => `.${extension}`)
  .join(',');

function getExtension(fileName: string): string {
  const match = fileName.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? '';
}

export function resolveDocumentMimeType(
  fileName: string,
  suppliedMimeType: string | null | undefined,
): string | null {
  const normalizedMimeType = suppliedMimeType?.trim().toLowerCase() ?? '';
  const extensionMimeType = MIME_TYPE_BY_EXTENSION[getExtension(fileName)];

  if (extensionMimeType) return extensionMimeType;

  return normalizedMimeType && normalizedMimeType !== 'application/octet-stream'
    ? normalizedMimeType
    : null;
}

export function getDocumentFormat(
  fileName: string,
  mimeType: string | null | undefined,
): DocumentFormat {
  const extension = getExtension(fileName);
  if (extension) return FORMAT_BY_EXTENSION[extension] ?? 'other';

  return (
    FORMAT_BY_MIME_TYPE[mimeType?.trim().toLowerCase() ?? '']
    ?? 'other'
  );
}

export function getDocumentFileTypeLabel(
  fileName: string,
  mimeType: string | null | undefined,
): string {
  const extension = getExtension(fileName);
  if (extension && FORMAT_BY_EXTENSION[extension]) {
    return LABEL_BY_EXTENSION[extension] ?? extension.toUpperCase();
  }

  const normalizedMimeType = mimeType?.trim().toLowerCase() ?? '';
  const matchingEntry = Object.entries(MIME_TYPE_BY_EXTENSION)
    .find(([, candidateMimeType]) => candidateMimeType === normalizedMimeType);

  return matchingEntry
    ? LABEL_BY_EXTENSION[matchingEntry[0]] ?? matchingEntry[0].toUpperCase()
    : 'FILE';
}

export function isOfficeDocument(format: DocumentFormat): boolean {
  return format === 'word' || format === 'spreadsheet' || format === 'presentation';
}

export function buildOfficeViewerUrl(signedFileUrl: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signedFileUrl)}`;
}

export function validateDocumentUpload(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  if (getDocumentFormat(file.name, file.type) === 'other') {
    return `${file.name} is not a supported document type.`;
  }

  if (file.size > DOCUMENT_MAX_FILE_SIZE_BYTES) {
    return `${file.name} is larger than the 25 MB upload limit.`;
  }

  return null;
}
