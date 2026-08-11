import { assertEquals } from "jsr:@std/assert@1.0.14";
import {
  isAuthUserMissingError,
  memberDeletionBlocker,
  resolveDeletionProfileId,
} from "./member-deletion.ts";

const removable = {
  actorIsTarget: false,
  targetIsAdmin: false,
  linkedElsewhere: false,
  agreementCount: 0,
  assignmentCount: 0,
  protectedAuthHistoryCount: 0,
  mailboxStatus: "pending_activation",
  accountStatus: "TERMS_PENDING",
  providerMailbox: {
    address: "test@carpmasons.ca",
    quotaMb: 500,
    usageMb: 0,
    dailySendLimit: 200,
    sentToday: 0,
    suspended: false,
  },
};

Deno.test("pending, unused member accounts can be deleted", () => {
  assertEquals(memberDeletionBlocker(removable), null);
});

Deno.test("active mailboxes cannot be hard-deleted", () => {
  assertEquals(
    memberDeletionBlocker({ ...removable, mailboxStatus: "active" }),
    "Active or suspended Lodge mailboxes cannot be hard-deleted from the roster.",
  );
});

Deno.test("accepted email agreements protect the member audit record", () => {
  assertEquals(
    memberDeletionBlocker({ ...removable, agreementCount: 1 }),
    "This member has accepted a Lodge email agreement and must be retained for the audit record.",
  );
});

Deno.test("mailboxes with activity cannot be hard-deleted", () => {
  assertEquals(
    memberDeletionBlocker({
      ...removable,
      providerMailbox: { ...removable.providerMailbox, usageMb: 1 },
    }),
    "This Lodge mailbox contains mail activity and cannot be hard-deleted.",
  );
});

Deno.test("mailboxes with unknown activity cannot be hard-deleted", () => {
  assertEquals(
    memberDeletionBlocker({
      ...removable,
      providerMailbox: { ...removable.providerMailbox, sentToday: null },
    }),
    "This Lodge mailbox's activity could not be verified, so it was not deleted.",
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
