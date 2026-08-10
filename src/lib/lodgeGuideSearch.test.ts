import { describe, expect, it } from 'vitest';
import { lodgeGuideSearchQueries } from '../../supabase/functions/_shared/lodge-guide-search';

describe('Lodge Guide retrieval queries', () => {
  it('keeps the complete question and adds meaningful event terms', () => {
    expect(lodgeGuideSearchQueries('When is the next lodge event?')).toEqual([
      'When is the next lodge event?',
      'next',
      'event',
    ]);
  });

  it('removes conversational filler and deduplicates terms', () => {
    expect(lodgeGuideSearchQueries('Please tell me the Lodge Secretary for the lodge.')).toEqual([
      'Please tell me the Lodge Secretary for the lodge.',
      'secretary',
    ]);
  });

  it('limits supplementary searches', () => {
    expect(lodgeGuideSearchQueries('alpha bravo charlie delta echo foxtrot')).toHaveLength(5);
  });
});
