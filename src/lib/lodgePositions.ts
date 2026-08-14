import type {
  LodgeMemberWithPosition,
  LodgePosition,
  MemberDirectoryProfileWithPosition,
} from './supabase';

export const LODGE_MEMBER_POSITION_RELATION_SELECT = [
  'lodge_positions:lodge_positions!lodge_members_position_id_fkey(id, name, display_order, position_type, max_holders, created_at)',
  'lodge_member_positions!lodge_member_positions_member_id_fkey(lodge_positions:lodge_positions!lodge_member_positions_position_id_fkey(id, name, display_order, position_type, max_holders, created_at))',
].join(', ');

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
