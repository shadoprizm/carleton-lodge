import { describe, expect, it } from 'vitest';
import {
  displayLodgePositionName,
  lodgeRoleGroup,
  lodgeRoleOrder,
} from './lodgeOfficerGroups';

describe('lodge officer presentation groups', () => {
  it('presents Lodge Auditor as elected even though it is stored as a functional role', () => {
    expect(lodgeRoleGroup('Lodge Auditor')).toBe('ELECTED');
  });

  it('separates appointed officers from other lodge roles', () => {
    expect(lodgeRoleGroup('Senior Deacon')).toBe('APPOINTED');
    expect(lodgeRoleGroup('Piper')).toBe('APPOINTED');
    expect(lodgeRoleGroup('Lodge Historian')).toBe('OTHER');
    expect(lodgeRoleGroup("Ass't Secretary")).toBe('OTHER');
  });

  it('treats the Immediate Past Master as ex officio, not elected', () => {
    expect(lodgeRoleGroup('Immed Past Master')).toBe('EX_OFFICIO');
  });

  it('uses full public-facing titles for abbreviated database names', () => {
    expect(displayLodgePositionName('Immed Past Master')).toBe('Immediate Past Master');
    expect(displayLodgePositionName('Dir. of Ceremonies')).toBe('Director of Ceremonies');
    expect(displayLodgePositionName('Secretary')).toBe('Secretary');
  });

  it('keeps each group in the requested ceremonial order', () => {
    expect(lodgeRoleOrder('Senior Warden', 'ELECTED')).toBeLessThan(
      lodgeRoleOrder('Lodge Auditor', 'ELECTED'),
    );
    expect(lodgeRoleOrder('Senior Deacon', 'APPOINTED')).toBeLessThan(
      lodgeRoleOrder('Piper', 'APPOINTED'),
    );
  });
});
