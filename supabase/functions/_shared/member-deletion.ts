import type { ProviderMailboxStatus } from "./lodge-email-provider.ts";

const REMOVABLE_ACCOUNT_STATUSES = new Set([
  "NOT_PROVISIONED",
  "PROVISIONING",
  "INVITATION_PENDING",
  "TERMS_PENDING",
  "PASSWORD_SETUP_PENDING",
  "ERROR",
]);

export type MemberDeletionPreflight = {
  actorIsTarget: boolean;
  targetIsAdmin: boolean;
  linkedElsewhere: boolean;
  agreementCount: number;
  assignmentCount: number;
  protectedAuthHistoryCount: number;
  mailboxStatus: string;
  accountStatus: string | null;
  providerMailbox?: ProviderMailboxStatus | null;
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
  if (preflight.agreementCount > 0) {
    return "This member has accepted a Lodge email agreement and must be retained for the audit record.";
  }
  if (preflight.assignmentCount > 0) {
    return "This member has an officer-mailbox assignment and must be retained for the audit record.";
  }
  if (preflight.protectedAuthHistoryCount > 0) {
    return "This account is part of a protected Lodge email audit record and cannot be hard-deleted.";
  }
  if (["active", "suspended"].includes(preflight.mailboxStatus)) {
    return "Active or suspended Lodge mailboxes cannot be hard-deleted from the roster.";
  }
  if (
    preflight.accountStatus &&
    !REMOVABLE_ACCOUNT_STATUSES.has(preflight.accountStatus)
  ) {
    return "This governed Lodge mailbox must be archived before the member can be deleted.";
  }
  if (
    preflight.providerMailbox &&
    (preflight.providerMailbox.usageMb === null ||
      preflight.providerMailbox.sentToday === null)
  ) {
    return "This Lodge mailbox's activity could not be verified, so it was not deleted.";
  }
  if (
    preflight.providerMailbox &&
    ((preflight.providerMailbox.usageMb ?? 0) > 0 ||
      (preflight.providerMailbox.sentToday ?? 0) > 0)
  ) {
    return "This Lodge mailbox contains mail activity and cannot be hard-deleted.";
  }

  return null;
}
