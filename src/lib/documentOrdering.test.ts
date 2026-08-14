import { describe, expect, it } from 'vitest';
import { moveDocumentInList } from './documentOrdering';

const documents = [
  { id: 'march' },
  { id: 'february' },
  { id: 'january' },
];

describe('moveDocumentInList', () => {
  it('moves a document without mutating the existing list', () => {
    const reordered = moveDocumentInList(documents, 'january', 'up');

    expect(reordered.map((document) => document.id)).toEqual([
      'march',
      'january',
      'february',
    ]);
    expect(documents.map((document) => document.id)).toEqual([
      'march',
      'february',
      'january',
    ]);
  });

  it('keeps the list unchanged at its boundaries', () => {
    expect(moveDocumentInList(documents, 'march', 'up')).toBe(documents);
    expect(moveDocumentInList(documents, 'january', 'down')).toBe(documents);
  });
});
