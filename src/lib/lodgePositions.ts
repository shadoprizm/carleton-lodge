import type {
  LodgeMemberWithPosition,
  LodgePosition,
  MemberDirectoryProfileWithPosition,
} from './supabase';

type MemberWithPositions = Pick<
  LodgeMemberWithPosition | MemberDirectoryProfileWithPosition,
  'lodge_positions' | 'positions'
>;

export function sortedPositions(positions: LodgePosition[]) {
  return [...positions].sort((left, right) =>
    left.display_order - right.display_order
    || left.name.localeCompare(right.name)
  );
}

export function memberPositions(member: MemberWithPositions) {
  if (member.positions.length > 0) return sortedPositions(member.positions);
  return member.lodge_positions ? [member.lodge_positions] : [];
}

export function positionsOfType(
  member: MemberWithPositions,
  positionType: LodgePosition['position_type'],
) {
  return memberPositions(member).filter(position => position.position_type === positionType);
}

export function primaryPosition(member: MemberWithPositions) {
  return memberPositions(member)[0] ?? null;
}

export function positionNames(member: MemberWithPositions, fallback = 'Lodge Member') {
  const names = memberPositions(member).map(position => position.name);
  return names.length > 0 ? names.join(' · ') : fallback;
}
