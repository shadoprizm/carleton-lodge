import { describe, expect, it } from 'vitest';
import type { LodgePosition } from './supabase';
import {
  LODGE_MEMBER_POSITION_RELATION_SELECT,
  memberPositions,
  positionNames,
  positionsOfType,
  primaryPosition,
} from './lodgePositions';

const historian: LodgePosition = {
  id: 'historian',
  name: 'Lodge Historian',
  display_order: 18,
  position_type: 'FUNCTIONAL',
  max_holders: 1,
  created_at: '2026-08-13T00:00:00Z',
};

const auditor: LodgePosition = {
  id: 'auditor',
  name: 'Lodge Auditor',
  display_order: 19,
  position_type: 'FUNCTIONAL',
  max_holders: 2,
  created_at: '2026-08-14T00:00:00Z',
};

describe('Lodge member positions', () => {
  it('disambiguates both PostgREST position relationships by foreign key', () => {
    expect(LODGE_MEMBER_POSITION_RELATION_SELECT).toContain('!lodge_members_position_id_fkey');
    expect(LODGE_MEMBER_POSITION_RELATION_SELECT).toContain('!lodge_member_positions_member_id_fkey');
    expect(LODGE_MEMBER_POSITION_RELATION_SELECT).toContain('!lodge_member_positions_position_id_fkey');
  });

  it('sorts and presents every concurrent position', () => {
    const member = { lodge_positions: historian, positions: [auditor, historian] };

    expect(memberPositions(member)).toEqual([historian, auditor]);
    expect(primaryPosition(member)).toEqual(historian);
    expect(positionNames(member)).toBe('Lodge Historian · Lodge Auditor');
    expect(positionsOfType(member, 'FUNCTIONAL')).toEqual([historian, auditor]);
  });

  it('keeps the compatibility primary position as a fallback', () => {
    const member = { lodge_positions: historian, positions: [] };

    expect(memberPositions(member)).toEqual([historian]);
    expect(positionNames(member)).toBe('Lodge Historian');
  });
});
