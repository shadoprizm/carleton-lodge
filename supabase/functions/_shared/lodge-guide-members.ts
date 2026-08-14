export const LODGE_SUPPORT_EMAIL = "support@carpmasons.ca";

export type LodgeGuideMemberDirectoryRow = {
  full_name: string;
  phone: string | null;
  lodge_email: string | null;
  join_date: string | null;
  bio: string | null;
  lodge_positions: { name: string } | null;
  lodge_member_positions?: Array<{
    lodge_positions: { name: string } | null;
  }>;
};

const CONTACT_QUESTION_PATTERN =
  /\b(email|e-mail|contact|reach|phone|telephone|call|message)\b/i;

export const lodgeGuideQuestionNeedsSupportContact = (question: string) =>
  CONTACT_QUESTION_PATTERN.test(question);

export const lodgeGuideMemberSourceBody = (
  member: LodgeGuideMemberDirectoryRow,
) => {
  const assignedPositionNames = (member.lodge_member_positions ?? [])
    .map(assignment => assignment.lodge_positions?.name)
    .filter((name): name is string => Boolean(name));
  const positionLabel = assignedPositionNames.length > 0
    ? assignedPositionNames.join(', ')
    : member.lodge_positions?.name ?? "Lodge Member";

  return [
    `Positions: ${positionLabel}`,
    `Lodge email: ${member.lodge_email ?? "Not currently listed or activated"}`,
    `Phone: ${member.phone ?? "Not currently listed"}`,
    `Member since: ${member.join_date ?? "Not currently listed"}`,
    member.bio ? `Biography: ${member.bio}` : null,
  ].filter((value): value is string => value !== null).join("\n");
};
