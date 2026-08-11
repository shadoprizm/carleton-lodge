import { assertEquals } from "jsr:@std/assert@1.0.14";
import {
  isAuthUserMissingError,
  mailboxDeletionConfirmationError,
  memberDeletionBlocker,
  resolveDeletionProfileId,
} from "./member-deletion.ts";

const removable = {
  actorIsTarget: false,
  targetIsAdmin: false,
  linkedElsewhere: false,
  assignmentCount: 0,
};

Deno.test("ordinary members can be deleted", () => {
  assertEquals(memberDeletionBlocker(removable), null);
});

Deno.test("active officer-mailbox assignments still require handover", () => {
  assertEquals(
    memberDeletionBlocker({ ...removable, assignmentCount: 1 }),
    "Complete or cancel this member's active officer-mailbox assignment before deleting the member.",
  );
});

Deno.test("mailbox contents require their own explicit confirmation", () => {
  assertEquals(
    mailboxDeletionConfirmationError("test@carpmasons.ca", false),
    "Confirm that the Lodge mailbox and all email in it may be permanently deleted.",
  );
  assertEquals(
    mailboxDeletionConfirmationError("test@carpmasons.ca", true),
    null,
  );
});

Deno.test("members without a mailbox do not need mailbox confirmation", () => {
  assertEquals(
    mailboxDeletionConfirmationError(null, false),
    null,
  );
});

Deno.test("administrators cannot delete their own account", () => {
  assertEquals(
    memberDeletionBlocker({
      ...removable,
      actorIsTarget: true,
      targetIsAdmin: true,
    }),
    "You cannot delete your own administrator account.",
  );
});

Deno.test("a retry recovers the Auth user from the server-side deletion job", () => {
  assertEquals(
    resolveDeletionProfileId(null, "0cecf4e7-51f0-4e65-bf68-64fb78e4671f"),
    {
      profileId: "0cecf4e7-51f0-4e65-bf68-64fb78e4671f",
      conflict: false,
    },
  );
});

Deno.test("a conflicting relink requires manual review", () => {
  assertEquals(
    resolveDeletionProfileId(
      "0cecf4e7-51f0-4e65-bf68-64fb78e4671f",
      "a610435c-3a3f-4e6a-a657-2d77cbac4e36",
    ),
    { profileId: null, conflict: true },
  );
});

Deno.test("a missing Auth user makes deletion retry-safe", () => {
  assertEquals(isAuthUserMissingError({ status: 404 }), true);
  assertEquals(isAuthUserMissingError({ code: "user_not_found" }), true);
  assertEquals(isAuthUserMissingError({ status: 503 }), false);
});
