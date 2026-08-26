import { assertEquals } from "jsr:@std/assert@1.0.14";
import {
  expiredRoleMailboxActivationTokenCanRenew,
  nextRoleMailboxActivationWindow,
  normalizeRoleMailboxActivationWindow,
  ROLE_MAILBOX_ACTIVATION_INITIAL_WINDOW,
  ROLE_MAILBOX_ACTIVATION_MAX_WINDOWS,
  ROLE_MAILBOX_ACTIVATION_WINDOW_HOURS,
  roleMailboxReminderIdempotencyKey,
  shouldQueueRoleMailboxActivationReminder,
} from "./role-mailbox-activation.ts";

Deno.test("role mailbox activation uses three complete 72-hour windows", () => {
  assertEquals(ROLE_MAILBOX_ACTIVATION_WINDOW_HOURS, 72);
  assertEquals(ROLE_MAILBOX_ACTIVATION_MAX_WINDOWS, 3);
  assertEquals(ROLE_MAILBOX_ACTIVATION_INITIAL_WINDOW, 1);
  assertEquals(nextRoleMailboxActivationWindow(1), 2);
  assertEquals(nextRoleMailboxActivationWindow(2), 3);
  assertEquals(nextRoleMailboxActivationWindow(3), null);
});

Deno.test("legacy activation tokens are treated as the first window", () => {
  assertEquals(normalizeRoleMailboxActivationWindow(undefined), 1);
  assertEquals(normalizeRoleMailboxActivationWindow(null), 1);
  assertEquals(nextRoleMailboxActivationWindow(undefined), 2);
});

Deno.test("role mailbox reminder idempotency is tied to the expired token", () => {
  assertEquals(
    roleMailboxReminderIdempotencyKey(
      "00000000-0000-4000-8000-000000000001",
      2,
    ),
    "role-mailbox-activation-reminder:00000000-0000-4000-8000-000000000001:window-2",
  );
});

Deno.test("role mailbox reminders require the same pending assignment", () => {
  const pending = {
    accountType: "OFFICER",
    accountStatus: "INVITATION_PENDING",
    currentAuthorizedMemberId: "member-1",
    memberId: "member-1",
    memberEmail: "member@example.com",
    linkedProfileId: "profile-1",
    hasPendingAssignment: true,
  };

  assertEquals(shouldQueueRoleMailboxActivationReminder(pending), true);
  assertEquals(
    shouldQueueRoleMailboxActivationReminder({
      ...pending,
      accountType: "FUNCTIONAL",
    }),
    true,
  );
  assertEquals(
    shouldQueueRoleMailboxActivationReminder({
      ...pending,
      accountStatus: "ACTIVE",
    }),
    false,
  );
  assertEquals(
    shouldQueueRoleMailboxActivationReminder({
      ...pending,
      currentAuthorizedMemberId: "member-2",
    }),
    false,
  );
  assertEquals(
    shouldQueueRoleMailboxActivationReminder({
      ...pending,
      hasPendingAssignment: false,
    }),
    false,
  );
});

Deno.test("an expired consumed token can recover an incomplete pending activation", () => {
  const expiredToken = {
    activationWindow: 1,
    expiresAt: "2026-08-24T12:00:00.000Z",
    revokedAt: null,
    now: "2026-08-25T12:00:00.000Z",
  };

  assertEquals(
    expiredRoleMailboxActivationTokenCanRenew({
      ...expiredToken,
      consumedAt: null,
    }),
    true,
  );
  assertEquals(
    expiredRoleMailboxActivationTokenCanRenew({
      ...expiredToken,
      consumedAt: "2026-08-21T12:00:00.000Z",
    }),
    true,
  );
  assertEquals(
    expiredRoleMailboxActivationTokenCanRenew({
      ...expiredToken,
      activationWindow: 3,
      consumedAt: "2026-08-21T12:00:00.000Z",
    }),
    false,
  );
  assertEquals(
    expiredRoleMailboxActivationTokenCanRenew({
      ...expiredToken,
      revokedAt: "2026-08-22T12:00:00.000Z",
      consumedAt: null,
    }),
    false,
  );
});
