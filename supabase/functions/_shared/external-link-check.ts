import {
  type ExternalWebsiteResource,
} from "../../../src/lib/externalLinks.ts";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const REACHABLE_RESTRICTED_STATUSES = new Set([401, 403, 429]);
const MAXIMUM_REDIRECTS = 4;
const USER_AGENT = "CarletonLodgeExternalLinkCheck/1.0 (+https://www.carpmasons.ca/links)";

const hostnameIsIpLiteral = (hostname: string) =>
  /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
  hostname.includes(":") ||
  hostname === "localhost";

export const externalLinkUrlIsAllowed = (
  value: string,
  allowedDomains: readonly string[],
) => {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      hostnameIsIpLiteral(hostname)
    ) return false;

    return allowedDomains.some((domain) =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
};

export type ExternalLinkCheckResult = {
  available: boolean;
  reason: string;
};

export const checkExternalLink = async (
  resource: ExternalWebsiteResource,
  request: typeof fetch = fetch,
): Promise<ExternalLinkCheckResult> => {
  let currentUrl = resource.url;

  for (let redirect = 0; redirect <= MAXIMUM_REDIRECTS; redirect += 1) {
    if (!externalLinkUrlIsAllowed(currentUrl, resource.allowedDomains)) {
      return { available: false, reason: "Redirected outside the approved domain" };
    }

    let response: Response;
    try {
      response = await request(currentUrl, {
        method: "GET",
        redirect: "manual",
        headers: {
          "Accept": "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1",
          "Range": "bytes=0-0",
          "User-Agent": USER_AGENT,
        },
        signal: AbortSignal.timeout(7_000),
      });
    } catch {
      return { available: false, reason: "Could not establish a secure connection" };
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => undefined);
      if (!location) return { available: false, reason: "The website returned an invalid redirect" };
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    await response.body?.cancel().catch(() => undefined);
    if (response.ok || REACHABLE_RESTRICTED_STATUSES.has(response.status)) {
      return { available: true, reason: `HTTP ${response.status}` };
    }
    return { available: false, reason: `HTTP ${response.status}` };
  }

  return { available: false, reason: "The website redirected too many times" };
};
