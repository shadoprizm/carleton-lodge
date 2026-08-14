import { describe, expect, it } from 'vitest';

const relationshipQuerySources = import.meta.glob(
  [
    '/src/components/MembersDirectory.tsx',
    '/src/pages/MemberProfilePage.tsx',
    '/supabase/functions/ask-carleton/index.ts',
  ],
  { eager: true, import: 'default', query: '?raw' },
) as Record<string, string>;

describe('Lodge position PostgREST relationship contract', () => {
  it('uses explicit foreign-key hints anywhere member positions are embedded', () => {
    expect(Object.keys(relationshipQuerySources)).toHaveLength(3);

    for (const source of Object.values(relationshipQuerySources)) {
      if (source.includes('LODGE_MEMBER_POSITION_RELATION_SELECT')) continue;

      expect(source).toContain('!lodge_members_position_id_fkey');
      expect(source).toContain('!lodge_member_positions_member_id_fkey');
      expect(source).toContain('!lodge_member_positions_position_id_fkey');
    }
  });
});
