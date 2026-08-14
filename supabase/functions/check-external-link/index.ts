import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import { findExternalWebsiteResource } from "../../../src/lib/externalLinks.ts";
import { checkExternalLink } from "../_shared/external-link-check.ts";
import {
  isAllowedWebOrigin,
  secureHeaders,
} from "../_shared/http-security.ts";

const productionSiteUrl = (configuredValue: string | undefined) => {
  const configured = configuredValue?.replace(/\/$/, "");
  return configured === "https://www.carpmasons.ca" || configured === "https://carpmasons.ca"
    ? configured
    : "https://www.carpmasons.ca";
};

const redirectResponse = (req: Request, location: string) =>
  new Response(null, {
    status: 302,
    headers: {
      ...secureHeaders(req, "GET, HEAD, OPTIONS"),
      "Location": location,
    },
  });

const responseJson = (
  req: Request,
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...secureHeaders(req, "GET, HEAD, OPTIONS"),
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return isAllowedWebOrigin(req)
      ? new Response(null, {
        status: 204,
        headers: secureHeaders(req, "GET, HEAD, OPTIONS"),
      })
      : responseJson(req, { error: "Forbidden" }, 403);
  }

  if (!isAllowedWebOrigin(req)) {
    return responseJson(req, { error: "Forbidden" }, 403);
  }

  if (!["GET", "HEAD"].includes(req.method)) {
    return responseJson(req, { error: "Method not allowed" }, 405, {
      "Allow": "GET, HEAD, OPTIONS",
    });
  }

  const resourceId = new URL(req.url).searchParams.get("resource") ?? "";
  const resource = findExternalWebsiteResource(resourceId);
  if (!resource) return responseJson(req, { error: "Unknown external resource" }, 404);

  const result = await checkExternalLink(resource);
  if (result.available) return redirectResponse(req, resource.url);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  let notice = "unavailable";

  if (supabaseUrl && serviceRoleKey) {
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await supabaseAdmin.from("external_link_alerts").insert({
      link_key: resource.id,
      link_name: resource.name,
      target_url: resource.url,
      failure_reason: result.reason.slice(0, 500),
    });

    if (!error) notice = "queued";
    else if (error.code === "23505") notice = "existing";
    else console.error("Could not queue external-link notification:", error.code);
  } else {
    console.error("check-external-link is missing required Supabase secrets");
  }

  const failureUrl = new URL("/links/external-unavailable", productionSiteUrl(Deno.env.get("SITE_URL")));
  failureUrl.searchParams.set("resource", resource.id);
  failureUrl.searchParams.set("notice", notice);
  return redirectResponse(req, failureUrl.toString());
});
