import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import {
  contentLengthExceeds,
  handlePreflight,
  jsonResponse,
  rejectDisallowedOrigin,
} from "../_shared/http-security.ts";
import { consumeRateLimit } from "../_shared/rate-limit.ts";

type RequestBody = {
  summonsId?: unknown;
};

type NotificationPreference = {
  id: string;
  profiles: { email: string } | Array<{ email: string }> | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function profileEmail(preference: NotificationPreference) {
  if (Array.isArray(preference.profiles)) {
    return preference.profiles[0]?.email?.trim().toLowerCase() ?? "";
  }
  return preference.profiles?.email?.trim().toLowerCase() ?? "";
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
  if (!authHeader) {
    return jsonResponse(req, { error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("send-summons-notification is missing required secrets");
    return jsonResponse(req, { error: "Service unavailable" }, 503);
  }

  try {
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const { data: canManage, error: permissionError } = await supabaseUser.rpc(
      "has_admin_section_permission",
      { target_section: "summons", access_level: "write" },
    );
    if (permissionError || canManage !== true) {
      return jsonResponse(req, { error: "Forbidden" }, 403);
    }

    let body: RequestBody;
    try {
      body = await req.json() as RequestBody;
    } catch {
      return jsonResponse(req, { error: "Invalid JSON body" }, 400);
    }
    const summonsId = typeof body.summonsId === "string"
      ? body.summonsId.trim()
      : "";
    if (!UUID_PATTERN.test(summonsId)) {
      return jsonResponse(req, { error: "A valid summonsId is required" }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const limit = await consumeRateLimit(
      supabaseAdmin,
      "summons-notify:user",
      user.id,
      10,
      60,
    );
    if (!limit.allowed) {
      return jsonResponse(
        req,
        { error: "Too many notification requests. Please wait a moment." },
        429,
        { "Retry-After": String(Math.max(limit.retry_after_seconds, 1)) },
      );
    }

    const { data: summons, error: summonsError } = await supabaseAdmin
      .from("summons")
      .select("id, title, month, content, notify_members")
      .eq("id", summonsId)
      .maybeSingle();
    if (summonsError) throw summonsError;
    if (!summons) {
      return jsonResponse(req, { error: "Summons not found" }, 404);
    }
    if (summons.notify_members !== true) {
      return jsonResponse(req, {
        message: "Notifications skipped",
        queued: 0,
      });
    }

    const { data: preferences, error: preferencesError } = await supabaseAdmin
      .from("notification_preferences")
      .select("id, profiles!inner(email)")
      .eq("email_notifications", true)
      .eq("notify_new_summons", true);
    if (preferencesError) throw preferencesError;

    const jobs = ((preferences ?? []) as NotificationPreference[])
      .map((preference) => ({
        preference,
        email: profileEmail(preference),
      }))
      .filter(({ email }) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      .map(({ preference, email }) => ({
        notification_type: "new_summons",
        recipient_profile_id: preference.id,
        recipient_email: email,
        payload: {
          summons_id: summons.id,
          title: String(summons.title).slice(0, 200),
          month: String(summons.month).slice(0, 100),
          excerpt: String(summons.content ?? "").slice(0, 600),
        },
        idempotency_key: `new-summons:${summons.id}:${preference.id}`,
      }));

    if (jobs.length > 0) {
      const { error: queueError } = await supabaseAdmin
        .from("notification_outbox")
        .upsert(jobs, {
          onConflict: "idempotency_key",
          ignoreDuplicates: true,
        });
      if (queueError) throw queueError;
    }

    return jsonResponse(req, {
      message: "Notifications queued",
      queued: jobs.length,
    });
  } catch (error) {
    console.error("send-summons-notification failed:", error);
    return jsonResponse(req, { error: "Internal server error" }, 500);
  }
});
