const DEFAULT_ALLOWED_ORIGINS = [
  "https://www.carpmasons.ca",
  "https://carpmasons.ca",
];

const ALLOWED_HEADERS =
  "authorization, apikey, content-type, x-client-info, x-supabase-api-version";

function configuredOrigins() {
  const configured = (Deno.env.get("ALLOWED_WEB_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set(configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS);
}

export function isAllowedWebOrigin(req: Request) {
  const origin = req.headers.get("origin");
  return !origin || configuredOrigins().has(origin);
}

export function secureHeaders(
  req: Request,
  methods = "POST, OPTIONS",
): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };

  const origin = req.headers.get("origin");
  if (origin && configuredOrigins().has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...secureHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

export function handlePreflight(req: Request) {
  if (!isAllowedWebOrigin(req)) {
    return jsonResponse(req, { error: "Forbidden" }, 403);
  }

  return new Response(null, {
    status: 204,
    headers: secureHeaders(req),
  });
}

export function rejectDisallowedOrigin(req: Request) {
  if (isAllowedWebOrigin(req)) return null;
  return jsonResponse(req, { error: "Forbidden" }, 403);
}

export function contentLengthExceeds(req: Request, maximumBytes: number) {
  const rawLength = req.headers.get("content-length");
  if (!rawLength) return false;
  const length = Number(rawLength);
  return Number.isFinite(length) && length > maximumBytes;
}
