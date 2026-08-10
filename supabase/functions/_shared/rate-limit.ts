type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
};

type RateLimitClient = {
  rpc: (
    functionName: string,
    parameters: Record<string, string | number>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function clientAddress(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown";
}

export async function rateLimitIdentifier(scope: string, identifier: string) {
  const salt = Deno.env.get("RATE_LIMIT_SALT") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!salt) throw new Error("Rate-limit salt is not configured");
  return sha256(`${scope}\u0000${identifier}\u0000${salt}`);
}

export async function consumeRateLimit(
  supabaseAdmin: RateLimitClient,
  scope: string,
  identifier: string,
  maximumRequests: number,
  windowSeconds: number,
) {
  const identifierHash = await rateLimitIdentifier(scope, identifier);
  const { data, error } = await supabaseAdmin.rpc("consume_api_rate_limit", {
    target_scope: scope,
    target_identifier_hash: identifierHash,
    maximum_requests: maximumRequests,
    window_seconds: windowSeconds,
  });

  if (error) throw error;
  const result = (Array.isArray(data) ? data[0] : data) as
    | RateLimitResult
    | null;
  if (!result) throw new Error("Rate-limit check returned no result");
  return result;
}
