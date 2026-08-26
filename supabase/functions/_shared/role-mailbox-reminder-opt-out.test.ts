import {
  assertEquals,
  assertNotEquals,
  assertRejects,
} from "jsr:@std/assert@1.0.14";
import {
  createRoleMailboxReminderOptOutToken,
  hashRoleMailboxReminderOptOutToken,
  isValidRoleMailboxReminderOptOutToken,
} from "./role-mailbox-reminder-opt-out.ts";

const secret = "0123456789abcdef0123456789abcdef";

Deno.test("role-mailbox reminder opt-out tokens are stable and URL-safe", async () => {
  const first = await createRoleMailboxReminderOptOutToken(
    secret,
    "reminder:1",
  );
  const second = await createRoleMailboxReminderOptOutToken(
    secret,
    "reminder:1",
  );
  assertEquals(first, second);
  assertEquals(first.length, 43);
  assertEquals(isValidRoleMailboxReminderOptOutToken(first), true);
});

Deno.test("role-mailbox reminder opt-out tokens are scoped to one reminder", async () => {
  const first = await createRoleMailboxReminderOptOutToken(
    secret,
    "reminder:1",
  );
  const second = await createRoleMailboxReminderOptOutToken(
    secret,
    "reminder:2",
  );
  assertNotEquals(first, second);
  assertNotEquals(
    await hashRoleMailboxReminderOptOutToken(first),
    await hashRoleMailboxReminderOptOutToken(second),
  );
});

Deno.test("role-mailbox reminder opt-out tokens require a strong secret", async () => {
  await assertRejects(
    () => createRoleMailboxReminderOptOutToken("too-short", "reminder:1"),
    Error,
    "not configured safely",
  );
});

Deno.test("role-mailbox reminder opt-out token validation rejects malformed values", () => {
  assertEquals(isValidRoleMailboxReminderOptOutToken("short"), false);
  assertEquals(isValidRoleMailboxReminderOptOutToken("a".repeat(43)), true);
  assertEquals(
    isValidRoleMailboxReminderOptOutToken(`${"a".repeat(42)}+`),
    false,
  );
});
