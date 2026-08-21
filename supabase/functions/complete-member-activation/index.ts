import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import {
  contentLengthExceeds,
  handlePreflight,
  jsonResponse,
  rejectDisallowedOrigin,
} from "../_shared/http-security.ts";
import {
  PERSONAL_MAILBOX_MEMBER_SELECT,
  type PersonalMailboxMember,
  provisionPersonalMailbox,
} from "../_shared/personal-mailbox-provisioning.ts";
import { consumeRateLimit } from "../_shared/rate-limit.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handlePreflight(req);

  const originRejection = rejectDisallowedOrigin(req);
  if (originRejection) return originRejection;

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405, {
      "Allow": "POST, OPTIONS",
    });
  }
  if (contentLengthExceeds(req, 256)) {
    return jsonResponse(req, { error: "Request body is too large" }, 413);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!supabaseUrl || !serviceRoleKey || !token) {
    return jsonResponse(
      req,
      { error: "An active member session is required" },
      401,
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: userResult, error: userError } = await supabaseAdmin.auth
      .getUser(token);
    if (userError || !userResult.user) {
      return jsonResponse(req, {
        error: "An active member session is required",
      }, 401);
    }

    const rateLimit = await consumeRateLimit(
      supabaseAdmin,
      "member-activation-complete",
      userResult.user.id,
      10,
      60 * 60,
    );
    if (!rateLimit.allowed) {
      return jsonResponse(
        req,
        {
          error: "Too many activation attempts. Please wait and try again.",
        },
        429,
        { "Retry-After": String(rateLimit.retry_after_seconds) },
      );
    }

    const { data: member, error: memberReadError } = await supabaseAdmin
      .from("lodge_members")
      .select(`${PERSONAL_MAILBOX_MEMBER_SELECT}, website_activated_at`)
      .eq("linked_profile_id", userResult.user.id)
      .maybeSingle();
    if (memberReadError) throw memberReadError;
    if (!member) {
      return jsonResponse(req, {
        error: "No Lodge roster record is linked to this account",
      }, 403);
    }

    const now = new Date().toISOString();
    if (!member.website_activated_at) {
      const { error: memberUpdateError } = await supabaseAdmin
        .from("lodge_members")
        .update({ website_activated_at: now, updated_at: now })
        .eq("id", member.id)
        .is("website_activated_at", null);
      if (memberUpdateError) throw memberUpdateError;
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ force_password_change: false, updated_at: now })
      .eq("id", userResult.user.id);
    if (profileError) throw profileError;

    let mailboxReady = false;
    let lodgeEmail: string | null = member.lodge_email ?? null;
    try {
      const mailbox = await provisionPersonalMailbox(
        supabaseAdmin,
        member as PersonalMailboxMember,
        { actorProfileId: userResult.user.id },
      );
      mailboxReady = true;
      lodgeEmail = mailbox.address;
    } catch (mailboxError) {
      // Website membership remains active even if MXroute is temporarily
      // unavailable. The failed mailbox is visible to Lodge administration and
      // can be retried idempotently without asking the member to verify again.
      console.error(
        `Membership activated but personal mailbox provisioning failed for ${member.id}:`,
        mailboxError instanceof Error
          ? mailboxError.message
          : String(mailboxError),
      );
    }

    return jsonResponse(req, {
      activated: true,
      activatedAt: member.website_activated_at ?? now,
      mailboxReady,
      lodgeEmail,
    });
  } catch (error) {
    console.error(
      "complete-member-activation error:",
      error instanceof Error ? error.message : String(error),
    );
    return jsonResponse(req, {
      error: "The membership activation could not be completed",
    }, 500);
  }
});
