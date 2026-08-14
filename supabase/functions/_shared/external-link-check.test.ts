import { assertEquals } from "jsr:@std/assert@1.0.14";
import { findExternalWebsiteResource } from "../../../src/lib/externalLinks.ts";
import { checkExternalLink, externalLinkUrlIsAllowed } from "./external-link-check.ts";

const resource = findExternalWebsiteResource("royal-arch-ontario")!;

Deno.test("external link check accepts only HTTPS URLs on the resource allowlist", () => {
  assertEquals(externalLinkUrlIsAllowed("https://www.royalarchmasons.on.ca/contact-us/", resource.allowedDomains), true);
  assertEquals(externalLinkUrlIsAllowed("https://example.com/", resource.allowedDomains), false);
  assertEquals(externalLinkUrlIsAllowed("http://royalarchmasons.on.ca/", resource.allowedDomains), false);
  assertEquals(externalLinkUrlIsAllowed("https://127.0.0.1/", resource.allowedDomains), false);
});

Deno.test("external link check follows approved redirects and accepts a healthy page", async () => {
  const requests: string[] = [];
  const result = await checkExternalLink(resource, (input) => {
    requests.push(String(input));
    return Promise.resolve(requests.length === 1
      ? new Response(null, { status: 301, headers: { Location: "/contact-us/" } })
      : new Response("ok", { status: 200 }));
  });

  assertEquals(result.available, true);
  assertEquals(requests, [resource.url, "https://www.royalarchmasons.on.ca/contact-us/"]);
});

Deno.test("external link check treats certificate, server, and unsafe redirect failures as unavailable", async () => {
  const connectionFailure = await checkExternalLink(resource, () => Promise.reject(new Error("certificate expired")));
  assertEquals(connectionFailure, { available: false, reason: "Could not establish a secure connection" });

  const serverFailure = await checkExternalLink(resource, () => Promise.resolve(new Response(null, { status: 503 })));
  assertEquals(serverFailure, { available: false, reason: "HTTP 503" });

  const unsafeRedirect = await checkExternalLink(resource, () => Promise.resolve(new Response(null, {
    status: 302,
    headers: { Location: "https://example.com/" },
  })));
  assertEquals(unsafeRedirect, { available: false, reason: "Redirected outside the approved domain" });
});

Deno.test("external link check treats access controls and rate limits as reachable", async () => {
  for (const status of [401, 403, 429]) {
    const result = await checkExternalLink(resource, () => Promise.resolve(new Response(null, { status })));
    assertEquals(result.available, true);
  }
});
