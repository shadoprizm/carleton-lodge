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

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const recoverableStatuses = ["unprovisioned", "provisioning", "error"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handlePreflight(req);

  const originRejection = rejectDisallowedOrigin(req);
  if (originRejection) return originRejection;
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405, {
      "Allow": "POST, OPTIONS",
    });
  }
  if (contentLengthExceeds(req, 8192)) {
    return jsonResponse(req, { error: "Request body is too large" }, 413);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authHeader) {
    return jsonResponse(req, { error: "Not authorized" }, 401);
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: { user }, error: userError } = await supabaseUser.auth
      .getUser();
    if (userError || !user) {
      return jsonResponse(req, { error: "Not authorized" }, 401);
    }

    const { data: allowed, error: permissionError } = await supabaseUser.rpc(
      "has_admin_section_permission",
      { target_section: "members", access_level: "write" },
    );
    if (permissionError || allowed !== true) {
      return jsonResponse(req, { error: "Forbidden" }, 403);
    }

    const limit = await consumeRateLimit(
      supabaseAdmin,
      "member-mailbox-provisioning:user",
      user.id,
      20,
      60 * 60,
    );
    if (!limit.allowed) {
      return jsonResponse(req, {
        error: "Too many mailbox provisioning requests. Please wait and retry.",
      }, 429, { "Retry-After": String(limit.retry_after_seconds) });
    }

    const body = await req.json().catch(() => ({})) as {
      mode?: unknown;
      confirmed?: unknown;
      memberIds?: unknown;
      batchSize?: unknown;
    };
    const mode = body.mode === "run" ? "run" : "preview";
    const targetsSpecified = body.memberIds !== undefined;
    if (targetsSpecified && !Array.isArray(body.memberIds)) {
      return jsonResponse(req, { error: "memberIds must be an array" }, 400);
    }
    const rawMemberIds = Array.isArray(body.memberIds) ? body.memberIds : [];
    if (rawMemberIds.length > 10 || rawMemberIds.some((value) =>
      typeof value !== "string" || !uuidPattern.test(value)
    )) {
      return jsonResponse(req, {
        error: "Provide no more than ten valid member identifiers",
      }, 400);
    }
    const requestedIds = [...new Set(rawMemberIds as string[])];
    if (mode === "run" && targetsSpecified && requestedIds.length === 0) {
      return jsonResponse(req, {
        error: "At least one member identifier is required",
      }, 400);
    }
    const batchSize = typeof body.batchSize === "number" &&
        Number.isFinite(body.batchSize)
      ? Math.min(Math.max(Math.trunc(body.batchSize), 1), 10)
      : 10;

    let query = supabaseAdmin
      .from("lodge_members")
      .select(PERSONAL_MAILBOX_MEMBER_SELECT)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (targetsSpecified) {
      query = query.in("id", requestedIds);
    } else {
      query = query.in("mailbox_status", recoverableStatuses).limit(batchSize);
    }

    const { data, error: memberError } = await query;
    if (memberError) throw memberError;
    const members = (data ?? []) as PersonalMailboxMember[];

    if (mode === "preview") {
      const { count, error: countError } = await supabaseAdmin
        .from("lodge_members")
        .select("id", { count: "exact", head: true })
        .in("mailbox_status", recoverableStatuses);
      if (countError) throw countError;
      return jsonResponse(req, {
        missing: count ?? 0,
        selected: members.length,
        totalQuotaMb: members.reduce(
          (total, member) => total + member.mailbox_quota_mb,
          0,
        ),
      });
    }

    if (body.confirmed !== true) {
      return jsonResponse(req, {
        error: "Explicit confirmation is required before provisioning mailboxes",
      }, 400);
    }

    const results: Array<Record<string, unknown>> = [];
    for (const member of members) {
      try {
        const result = await provisionPersonalMailbox(supabaseAdmin, member, {
          actorProfileId: user.id,
        });
        results.push({
          memberId: member.id,
          memberName: member.full_name,
          ok: true,
          address: result.address,
          status: result.status,
          providerMailboxCreated: result.providerMailboxCreated,
        });
      } catch (error) {
        console.error(
          `Could not provision personal mailbox for member ${member.id}:`,
          error instanceof Error ? error.message : String(error),
        );
        results.push({
          memberId: member.id,
          memberName: member.full_name,
          ok: false,
          error: error instanceof Error
            ? error.message
            : "Mailbox provisioning failed",
        });
      }
    }

    const { count: remaining, error: remainingError } = await supabaseAdmin
      .from("lodge_members")
      .select("id", { count: "exact", head: true })
      .in("mailbox_status", recoverableStatuses);
    if (remainingError) throw remainingError;

    return jsonResponse(req, {
      attempted: results.length,
      provisioned: results.filter((result) => result.ok === true).length,
      failed: results.filter((result) => result.ok !== true).length,
      remaining: remaining ?? 0,
      results,
      notificationsSent: 0,
    });
  } catch (error) {
    console.error(
      "provision-member-mailboxes error:",
      error instanceof Error ? error.message : String(error),
    );
    return jsonResponse(req, {
      error: "The personal mailbox provisioning request could not be completed",
    }, 500);
  }
});
