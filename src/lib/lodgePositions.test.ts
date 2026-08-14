import { describe, expect, it } from 'vitest';
import type { LodgePosition } from './supabase';
import { memberPositions, positionNames, positionsOfType, primaryPosition } from './lodgePositions';

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
