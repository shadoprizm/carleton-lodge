export type DocumentMoveDirection = 'up' | 'down';

export function moveDocumentInList<T extends { id: string }>(
  documents: T[],
  documentId: string,
  direction: DocumentMoveDirection,
): T[] {
  const currentIndex = documents.findIndex((document) => document.id === documentId);
  const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

  if (
    currentIndex === -1
    || nextIndex < 0
    || nextIndex >= documents.length
  ) {
    return documents;
  }

  const reordered = [...documents];
  [reordered[currentIndex], reordered[nextIndex]] = [
    reordered[nextIndex],
    reordered[currentIndex],
  ];
  return reordered;
}
