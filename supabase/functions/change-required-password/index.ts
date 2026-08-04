import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import {
  contentLengthExceeds,
  handlePreflight,
  jsonResponse,
  rejectDisallowedOrigin,
} from "../_shared/http-security.ts";
import { consumeRateLimit } from "../_shared/rate-limit.ts";

const COMMON_PASSWORDS = new Set([
  "123456789012",
  "password1234",
  "qwertyuiop12",
  "letmein12345",
  "carleton465",
  "carletonlodge",
]);

async function sha1Hex(value: string) {
  // SHA-1 is required by the Pwned Passwords k-anonymity protocol. It is never
  // used to store or authenticate the password.
  const digest = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

async function isKnownBreachedPassword(password: string) {
  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const response = await fetch(
    `https://api.pwnedpasswords.com/range/${prefix}`,
    {
      headers: {
        "Add-Padding": "true",
        "User-Agent": "Carleton-Lodge-Password-Security",
      },
      signal: AbortSignal.timeout(6000),
    },
  );
  if (!response.ok) {
    throw new Error(`Pwned Passwords returned HTTP ${response.status}`);
  }

  const candidates = await response.text();
  return candidates.split(/\r?\n/).some((line) => {
    const [candidateSuffix, count] = line.split(":", 2);
    return candidateSuffix === suffix && Number(count) > 0;
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handlePreflight(req);

  const originRejection = rejectDisallowedOrigin(req);
  if (originRejection) return originRejection;

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405, {
      "Allow": "POST, OPTIONS",
    });
  }
  if (contentLengthExceeds(req, 4096)) {
    return jsonResponse(req, { error: "Request body is too large" }, 413);
  }

  const authHeader = req.headers.get("authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authHeader) {
    return jsonResponse(req, { error: "Unauthorized" }, 401);
  }
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("change-required-password is missing required secrets");
    return jsonResponse(req, { error: "Service unavailable" }, 503);
  }

  try {
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: "carletonlodge" },
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    let body: { password?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, { error: "Invalid JSON body" }, 400);
    }
    const password = typeof body.password === "string" ? body.password : "";
    const emailPrefix = user.email?.split("@")[0]?.toLowerCase() ?? "";
    if (
      password.length < 8 ||
      password.length > 128 ||
      COMMON_PASSWORDS.has(password.toLowerCase()) ||
      (emailPrefix.length >= 4 && password.toLowerCase().includes(emailPrefix))
    ) {
      return jsonResponse(req, {
        error:
          "Use at least 8 characters and avoid common words or your email address.",
      }, 400);
    }

    let breached = false;
    try {
      breached = await isKnownBreachedPassword(password);
    } catch (error) {
      console.error("Could not verify password breach status:", error);
      return jsonResponse(req, {
        error: "Password safety could not be verified. Please try again.",
      }, 503);
    }
    if (breached) {
      return jsonResponse(req, {
        error:
          "This password appears in known data breaches. Choose a unique password.",
      }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: "carletonlodge" },
    });
    const limit = await consumeRateLimit(
      supabaseAdmin,
      "password-change:user",
      user.id,
      5,
      60 * 60,
    );
    if (!limit.allowed) {
      return jsonResponse(
        req,
        { error: "Too many password-change attempts. Try again later." },
        429,
        { "Retry-After": String(Math.max(limit.retry_after_seconds, 1)) },
      );
    }

    const { error: updateError } = await supabaseUser.auth.updateUser({
      password,
    });
    if (updateError) {
      console.error("Auth rejected required password change:", updateError);
      // Supabase Auth's own error messages (e.g. "New password should be
      // different from the old password.") are written to be shown to the
      // end user directly -- surface them instead of a generic fallback that
      // hides the actual, actionable reason.
      return jsonResponse(req, {
        error: updateError.message ||
          "The password could not be changed. Choose a different password.",
      }, 400);
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        force_password_change: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    if (profileError) throw profileError;

    return jsonResponse(req, { changed: true });
  } catch (error) {
    console.error("change-required-password failed:", error);
    return jsonResponse(req, { error: "Unable to change password" }, 500);
  }
});
