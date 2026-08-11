import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import {
  canonicalMessageMaterial,
  messageAuthenticationPassed,
  messageReachedMailroom,
} from "./mailroom-security.ts";

Deno.test("Mailroom accepts DMARC or combined DKIM and SPF authentication", () => {
  assert(messageAuthenticationPassed({ "Authentication-Results": "mx.example; dmarc=pass" }));
  assert(messageAuthenticationPassed({ "authentication-results": "dkim=pass; spf=pass; dmarc=none" }));
  assertFalse(messageAuthenticationPassed({ "authentication-results": "dkim=pass; spf=fail" }));
});

Deno.test("Mailroom requires the designated public or inbound recipient", () => {
  assert(messageReachedMailroom([["Secretary <mailroom@inbound.carpmasons.ca>"]]));
  assert(messageReachedMailroom([["mailroom@carpmasons.ca"]]));
  assertFalse(messageReachedMailroom([["communications@inbound.carpmasons.ca"]]));
});

Deno.test("message material is stable across attachment order", () => {
  const first = canonicalMessageMaterial({
    from: "Secretary <secretary@example.ca>",
    subject: "Summons",
    text: "Body\r\ntext",
    attachments: [{ filename: "b.pdf" }, { filename: "a.pdf" }],
  });
  const second = canonicalMessageMaterial({
    from: "secretary@example.ca",
    subject: "Summons",
    text: "Body\ntext",
    attachments: [{ filename: "a.pdf" }, { filename: "b.pdf" }],
  });
  assertEquals(first, second);
});
