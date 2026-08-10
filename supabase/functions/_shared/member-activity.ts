export type ActivityProfile = {
  id: string;
  email: string;
  created_at: string;
};

export type ActivityAuthUser = {
  id: string;
  email?: string;
  last_sign_in_at?: string;
};

export type ActivityRosterMember = {
  linked_profile_id: string | null;
  full_name: string;
};

export type ActivityTimestamp = {
  profile_id: string;
  last_seen_at: string;
};

export type MemberActivitySummary = {
  profile_id: string;
  full_name: string | null;
  email: string;
  joined_at: string;
  last_login_at: string | null;
  last_seen_at: string | null;
};

export function buildMemberActivitySummaries(
  profiles: ActivityProfile[],
  authUsers: ActivityAuthUser[],
  rosterMembers: ActivityRosterMember[],
  activity: ActivityTimestamp[],
): MemberActivitySummary[] {
  const authById = new Map(authUsers.map((user) => [user.id, user]));
  const nameByProfileId = new Map(
    rosterMembers.flatMap((member) =>
      member.linked_profile_id
        ? [[member.linked_profile_id, member.full_name] as const]
        : []
    ),
  );
  const activityByProfileId = new Map(
    activity.map((item) => [item.profile_id, item.last_seen_at]),
  );

  return profiles
    .map((profile) => {
      const authUser = authById.get(profile.id);
      return {
        profile_id: profile.id,
        full_name: nameByProfileId.get(profile.id) ?? null,
        email: authUser?.email ?? profile.email,
        joined_at: profile.created_at,
        last_login_at: authUser?.last_sign_in_at ?? null,
        last_seen_at: activityByProfileId.get(profile.id) ?? null,
      };
    })
    .sort((left, right) =>
      (left.full_name ?? left.email).localeCompare(
        right.full_name ?? right.email,
        "en-CA",
        { sensitivity: "base" },
      )
    );
}
