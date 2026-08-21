import { assertEquals } from "jsr:@std/assert@1.0.14";
import { personalMailboxCandidates } from "./personal-mailbox-provisioning.ts";

Deno.test("personal mailbox candidates are deterministic and collision-safe", () => {
  assertEquals(personalMailboxCandidates("V. W. Bro. Blake Farmer", 4), [
    "blake.farmer@carpmasons.ca",
    "blake.farmer2@carpmasons.ca",
    "blake.farmer3@carpmasons.ca",
    "blake.farmer4@carpmasons.ca",
  ]);
});

Deno.test("personal mailbox candidates keep MXroute local parts bounded", () => {
  const candidates = personalMailboxCandidates(
    "Extraordinarilylongfirstname Extraordinarilylongfamilyname",
    100,
  );

  assertEquals(candidates.length, 100);
  assertEquals(
    candidates.every((address) => address.split("@", 1)[0].length <= 48),
    true,
  );
  assertEquals(new Set(candidates).size, candidates.length);
});
