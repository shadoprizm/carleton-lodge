import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import {
  contentLengthExceeds,
  handlePreflight,
  jsonResponse,
  rejectDisallowedOrigin,
} from "../_shared/http-security.ts";
import {
  isPlausibleMemberEmail,
  normalizeMemberEmail,
} from "../_shared/member-access.ts";
import { consumeRateLimit } from "../_shared/rate-limit.ts";

type RequestBody = {
  memberId?: unknown;
  email?: unknown;
  requestId?: unknown;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);

async function processNotificationQueue(
  supabaseUrl: string,
  serviceRoleKey: string,
) {
  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/functions/v1/cl-process-notifications`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ batchSize: 25 }),
    },
  );

  if (!response.ok) {
    throw new Error(`Notification processor returned HTTP ${response.status}`);
  }
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!supabaseUrl || !serviceRoleKey || !token) {
    return jsonResponse(req, { error: "Not authorized" }, 401);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: userResult, error: userError } = await supabaseAdmin.auth
      .getUser(token);
    if (userError || !userResult.user) {
      return jsonResponse(req, { error: "Not authorized" }, 401);
    }

    const [{ data: profile, error: profileError }, {
      data: permission,
      error: permissionError,
    }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("is_admin")
        .eq("id", userResult.user.id)
        .maybeSingle(),
      supabaseAdmin
        .from("admin_section_permissions")
        .select("can_write")
        .eq("profile_id", userResult.user.id)
        .eq("section", "members")
        .eq("can_write", true)
        .maybeSingle(),
    ]);
    if (profileError) throw profileError;
    if (permissionError) throw permissionError;
    if (profile?.is_admin !== true && permission?.can_write !== true) {
      return jsonResponse(req, { error: "Not authorized" }, 403);
    }

    const rateLimit = await consumeRateLimit(
      supabaseAdmin,
      "manage-member-login",
      userResult.user.id,
      20,
      60 * 60,
    );
    if (!rateLimit.allowed) {
      return jsonResponse(
        req,
        {
          error: "Too many invitations. Please wait and try again.",
        },
        429,
        { "Retry-After": String(rateLimit.retry_after_seconds) },
      );
    }

    const body = await req.json().catch(() => ({})) as RequestBody;
    const memberId = typeof body.memberId === "string"
      ? body.memberId.trim()
      : "";
    const email = normalizeMemberEmail(body.email);
    const requestId = typeof body.requestId === "string" &&
        isUuid(body.requestId)
      ? body.requestId
      : crypto.randomUUID();

    if (!isUuid(memberId)) {
      return jsonResponse(req, { error: "A valid member is required" }, 400);
    }
    if (!isPlausibleMemberEmail(email)) {
      return jsonResponse(
        req,
        { error: "A valid personal email is required" },
        400,
      );
    }

    const idempotencyKey =
      `member-activation-invitation:${memberId}:${requestId}`;
    const { data: existingRequest, error: existingRequestError } =
      await supabaseAdmin
        .from("notification_outbox")
        .select("id, status")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
    if (existingRequestError) throw existingRequestError;
    if (existingRequest) {
      return jsonResponse(req, {
        queued: true,
        duplicate: true,
        notificationId: existingRequest.id,
        notificationStatus: existingRequest.status,
      });
    }

    const { data: recentEmail, error: recentEmailError } = await supabaseAdmin
      .from("notification_outbox")
      .select("id")
      .eq("notification_type", "member_activation_invitation")
      .eq("recipient_email", email)
      .in("status", ["queued", "processing", "sent"])
      .gte("created_at", new Date(Date.now() - 60_000).toISOString())
      .limit(1)
      .maybeSingle();
    if (recentEmailError) throw recentEmailError;
    if (recentEmail) {
      return jsonResponse(req, {
        error:
          "Activation instructions were sent recently. Wait one minute before sending another copy.",
      }, 429);
    }

    const { data: member, error: memberError } = await supabaseAdmin
      .from("lodge_members")
      .select("id, full_name, linked_profile_id")
      .eq("id", memberId)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!member) return jsonResponse(req, { error: "Member not found" }, 404);

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("lodge_members")
      .update({
        email,
        website_activation_invited_at: now,
        updated_at: now,
      })
      .eq("id", memberId);
    if (updateError) throw updateError;

    const { data: notification, error: notificationError } = await supabaseAdmin
      .from("notification_outbox")
      .insert({
        notification_type: "member_activation_invitation",
        recipient_profile_id: member.linked_profile_id,
        recipient_email: email,
        payload: {
          member_id: member.id,
          member_name: member.full_name,
          requested_by_profile_id: userResult.user.id,
        },
        idempotency_key: idempotencyKey,
        max_attempts: 3,
      })
      .select("id, status")
      .single();
    if (notificationError) throw notificationError;

    let deliveryStatus = notification.status;
    try {
      await processNotificationQueue(supabaseUrl, serviceRoleKey);
      const { data: delivered, error: deliveryError } = await supabaseAdmin
        .from("notification_outbox")
        .select("status")
        .eq("id", notification.id)
        .single();
      if (deliveryError) throw deliveryError;
      deliveryStatus = delivered.status;
    } catch (processorError) {
      console.error(
        "Member activation invitation remains queued:",
        processorError instanceof Error
          ? processorError.message
          : String(processorError),
      );
    }

    return jsonResponse(req, {
      queued: true,
      memberName: member.full_name,
      email,
      notificationId: notification.id,
      notificationStatus: deliveryStatus,
    });
  } catch (error) {
    console.error(
      "manage-member-login error:",
      error instanceof Error ? error.message : String(error),
    );
    return jsonResponse(req, {
      error: "The activation invitation could not be prepared",
    }, 500);
  }
});
