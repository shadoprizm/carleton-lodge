import { assertEquals } from "jsr:@std/assert@1.0.14";
import { buildMemberActivitySummaries } from "./member-activity.ts";

Deno.test("member activity uses Auth for login and the lodge table for visits", () => {
  const summaries = buildMemberActivitySummaries(
    [{
      id: "profile-1",
      email: "old@example.test",
      created_at: "2026-01-01T00:00:00Z",
    }],
    [{
      id: "profile-1",
      email: "member@example.test",
      last_sign_in_at: "2026-08-10T12:00:00Z",
    }],
    [{ linked_profile_id: "profile-1", full_name: "Example Member" }],
    [{
      profile_id: "profile-1",
      last_seen_at: "2026-08-10T12:15:00Z",
    }],
  );

  assertEquals(summaries, [{
    profile_id: "profile-1",
    full_name: "Example Member",
    email: "member@example.test",
    joined_at: "2026-01-01T00:00:00Z",
    last_login_at: "2026-08-10T12:00:00Z",
    last_seen_at: "2026-08-10T12:15:00Z",
  }]);
});

Deno.test("member activity returns no login when Auth has no sign-in", () => {
  const [summary] = buildMemberActivitySummaries(
    [{
      id: "profile-2",
      email: "never@example.test",
      created_at: "2026-02-01T00:00:00Z",
    }],
    [{ id: "profile-2", email: "never@example.test" }],
    [],
    [],
  );

  assertEquals(summary.full_name, null);
  assertEquals(summary.last_login_at, null);
  assertEquals(summary.last_seen_at, null);
});
