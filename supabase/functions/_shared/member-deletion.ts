export type MemberDeletionPreflight = {
  actorIsTarget: boolean;
  targetIsAdmin: boolean;
  linkedElsewhere: boolean;
  assignmentCount: number;
};

export type DeletionProfileResolution = {
  profileId: string | null;
  conflict: boolean;
};

export function resolveDeletionProfileId(
  linkedProfileId: string | null,
  pendingProfileId: string | null,
): DeletionProfileResolution {
  if (
    linkedProfileId && pendingProfileId &&
    linkedProfileId !== pendingProfileId
  ) {
    return { profileId: null, conflict: true };
  }

  return {
    profileId: linkedProfileId ?? pendingProfileId,
    conflict: false,
  };
}

export function isAuthUserMissingError(error: unknown): boolean {
  const candidate = error as { status?: unknown; code?: unknown } | null;
  return candidate?.status === 404 || candidate?.code === "user_not_found";
}

export function mailboxDeletionConfirmationError(
  mailboxAddress: string | null,
  deleteMailboxContents: boolean,
): string | null {
  if (mailboxAddress && !deleteMailboxContents) {
    return "Confirm that the Lodge mailbox and all email in it may be permanently deleted.";
  }

  return null;
}

export function memberDeletionBlocker(
  preflight: MemberDeletionPreflight,
): string | null {
  if (preflight.actorIsTarget) {
    return "You cannot delete your own administrator account.";
  }
  if (preflight.targetIsAdmin) {
    return "Remove this user's administrator access before deleting the member.";
  }
  if (preflight.linkedElsewhere) {
    return "This website account is linked to another roster entry and cannot be deleted here.";
  }
  if (preflight.assignmentCount > 0) {
    return "Complete or cancel this member's active officer-mailbox assignment before deleting the member.";
  }

  return null;
}
