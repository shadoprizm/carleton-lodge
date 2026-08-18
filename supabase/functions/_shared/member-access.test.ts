import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import {
  createUnknownPassword,
  isPlausibleMemberEmail,
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

Deno.test("unknown passwords are strong, random, and never member supplied", () => {
  const first = createUnknownPassword();
  const second = createUnknownPassword();
  assert(first.startsWith("Aa1!"));
  assert(first.length > 32);
  assert(first !== second);
});
