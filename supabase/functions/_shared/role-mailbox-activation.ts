export const ROLE_MAILBOX_ACTIVATION_WINDOW_HOURS = 72;
export const ROLE_MAILBOX_ACTIVATION_MAX_WINDOWS = 3;
export const ROLE_MAILBOX_ACTIVATION_INITIAL_WINDOW = 1;

export type RoleMailboxActivationWindow = 1 | 2 | 3;

export function normalizeRoleMailboxActivationWindow(
  value: unknown,
): RoleMailboxActivationWindow {
  return value === 2 || value === 3
    ? value
    : ROLE_MAILBOX_ACTIVATION_INITIAL_WINDOW;
}

export function nextRoleMailboxActivationWindow(
  value: unknown,
): RoleMailboxActivationWindow | null {
  const current = normalizeRoleMailboxActivationWindow(value);
  return current < ROLE_MAILBOX_ACTIVATION_MAX_WINDOWS
    ? (current + 1) as RoleMailboxActivationWindow
    : null;
}

export function roleMailboxReminderIdempotencyKey(
  expiredTokenId: string,
  nextWindow: RoleMailboxActivationWindow,
) {
  return `role-mailbox-activation-reminder:${expiredTokenId}:window-${nextWindow}`;
}

export function expiredRoleMailboxActivationTokenCanRenew(input: {
  activationWindow: unknown;
  expiresAt: string;
  revokedAt: string | null;
  consumedAt: string | null;
  now: string;
}) {
  const expiresAt = new Date(input.expiresAt).getTime();
  const now = new Date(input.now).getTime();
  const consumedAtIsValid = input.consumedAt === null ||
    Number.isFinite(new Date(input.consumedAt).getTime());
  return input.revokedAt === null &&
    nextRoleMailboxActivationWindow(input.activationWindow) !== null &&
    consumedAtIsValid && Number.isFinite(expiresAt) && Number.isFinite(now) &&
    expiresAt <= now;
}

export function shouldQueueRoleMailboxActivationReminder(input: {
  accountType: unknown;
  accountStatus: unknown;
  currentAuthorizedMemberId: unknown;
  memberId: string;
  memberEmail: unknown;
  linkedProfileId: unknown;
  hasPendingAssignment: boolean;
}) {
  return (input.accountType === "OFFICER" ||
    input.accountType === "FUNCTIONAL") &&
    input.accountStatus === "INVITATION_PENDING" &&
    input.currentAuthorizedMemberId === input.memberId &&
    typeof input.memberEmail === "string" && input.memberEmail.length > 0 &&
    typeof input.linkedProfileId === "string" &&
    input.linkedProfileId.length > 0 && input.hasPendingAssignment;
}
