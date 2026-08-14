import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.14";
import { renderExternalLinkAlertEmail } from "./external-link-alert-email.ts";

Deno.test("external-link alert email identifies the link and promises only one message", () => {
  const email = renderExternalLinkAlertEmail({
    linkName: "Example resource",
    targetUrl: "https://example.com/",
    failureReason: "HTTP 503",
    detectedAt: "2026-08-14T16:00:00Z",
    siteUrl: "https://www.carpmasons.ca",
  });

  assertEquals(email.subject, "Broken external link detected: Example resource");
  assertStringIncludes(email.text, "only automatic email");
  assertStringIncludes(email.text, "Address: https://example.com/");
  assertStringIncludes(email.text, "Failure: HTTP 503");
  assertStringIncludes(email.text, "Review Masonic links: https://www.carpmasons.ca/links");
});
