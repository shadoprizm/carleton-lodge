export const ELECTED_OFFICER_POSITION_NAMES = [
  'Worshipful Master',
  'Senior Warden',
  'Junior Warden',
  'Chaplain',
  'Treasurer',
  'Secretary',
  'Tyler',
  'Lodge Auditor',
] as const;

export const EX_OFFICIO_POSITION_NAMES = [
  'Immed Past Master',
] as const;

export const APPOINTED_OFFICER_POSITION_NAMES = [
  'Senior Deacon',
  'Junior Deacon',
  'Dir. of Ceremonies',
  'Inner Guard',
  'Senior Steward',
  'Junior Steward',
  'Piper',
] as const;

const electedOfficerNames = new Set<string>(ELECTED_OFFICER_POSITION_NAMES);
const exOfficioNames = new Set<string>(EX_OFFICIO_POSITION_NAMES);
const appointedOfficerNames = new Set<string>(APPOINTED_OFFICER_POSITION_NAMES);

const positionLabels: Record<string, string> = {
  'Dir. of Ceremonies': 'Director of Ceremonies',
  'Immed Past Master': 'Immediate Past Master',
};

export type LodgeRoleGroup = 'ELECTED' | 'EX_OFFICIO' | 'APPOINTED' | 'OTHER';

export function lodgeRoleGroup(positionName: string): LodgeRoleGroup {
  if (exOfficioNames.has(positionName)) return 'EX_OFFICIO';
  if (electedOfficerNames.has(positionName)) return 'ELECTED';
  if (appointedOfficerNames.has(positionName)) return 'APPOINTED';
  return 'OTHER';
}

export function displayLodgePositionName(positionName: string) {
  return positionLabels[positionName] ?? positionName;
}

export function lodgeRoleOrder(positionName: string, group: LodgeRoleGroup) {
  const names: readonly string[] = group === 'ELECTED'
    ? ELECTED_OFFICER_POSITION_NAMES
    : group === 'EX_OFFICIO'
      ? EX_OFFICIO_POSITION_NAMES
      : group === 'APPOINTED'
        ? APPOINTED_OFFICER_POSITION_NAMES
        : [];

  const index = names.indexOf(positionName);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
