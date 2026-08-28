import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import {
  createUnknownPassword,
  isPlausibleMemberEmail,
  MEMBER_ACCESS_CODE_EMAIL_MAX_REQUESTS,
  MEMBER_ACCESS_CODE_EMAIL_WINDOW_SECONDS,
  normalizeMemberEmail,
} from "./member-access.ts";

Deno.test("member email normalization is case-insensitive and trims whitespace", () => {
  assertEquals(
    normalizeMemberEmail("  Member.Example@Email.COM  "),
    "member.example@email.com",
  );
  assertEquals(normalizeMemberEmail(null), "");
});

Deno.test("member email validation rejects malformed and oversized values", () => {
  assert(isPlausibleMemberEmail("member@example.com"));
  assertFalse(isPlausibleMemberEmail("member"));
  assertFalse(isPlausibleMemberEmail(`member@${"a".repeat(250)}.com`));
});

Deno.test("member access codes allow only one email request per ten-minute window", () => {
  assertEquals(MEMBER_ACCESS_CODE_EMAIL_MAX_REQUESTS, 1);
  assertEquals(MEMBER_ACCESS_CODE_EMAIL_WINDOW_SECONDS, 10 * 60);
});

Deno.test("unknown passwords are strong, random, and never member supplied", () => {
  const first = createUnknownPassword();
  const second = createUnknownPassword();
  assert(first.startsWith("Aa1!"));
  assert(first.length > 32);
  assert(first !== second);
});
