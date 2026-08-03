import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import { consumeRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.carpmasons.ca",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
  "Access-Control-Max-Age": "600",
  "Cache-Control": "no-store",
  "Content-Security-Policy":
    "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "Vary": "Origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

type RequestBody = {
  memberId?: string;
  email?: string;
  requestId?: string;
};

type AuthUserSummary = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

type AuthAdminClient = {
  auth: {
    admin: {
      listUsers: (params: {
        page: number;
        perPage: number;
      }) => Promise<{
        data: { users: AuthUserSummary[] } | null;
        error: Error | null;
      }>;
    };
  };
};

type SectionPermission = {
  section: string;
  can_read: boolean;
  can_write: boolean;
  can_approve: boolean;
};

const sectionLabels: Record<string, string> = {
  members: "Members",
  events: "Events",
  summons: "Summons",
  library: "Library",
  history: "History",
  gallery: "Gallery",
  contact: "Contact",
  communications: "Communications",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function createUnknownPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const random = btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

  return `Aa1!${random}`;
}

function describePermissions(
  isAdmin: boolean,
  permissions: SectionPermission[],
) {
  if (isAdmin) return ["Full administration access"];

  return permissions
    .filter((permission) =>
      permission.can_read || permission.can_write || permission.can_approve
    )
    .map((permission) => {
      const capabilities = [
        permission.can_read ? "view" : "",
        permission.can_write ? "manage" : "",
        permission.can_approve ? "approve" : "",
      ].filter(Boolean);

      return `${sectionLabels[permission.section] ?? permission.section}: ${
        capabilities.join(", ")
      }`;
    });
}

async function findAuthUserByEmail(
  supabaseAdmin: AuthAdminClient,
  email: string,
) {
  const normalizedEmail = email.toLowerCase();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) throw error;

    const users = data?.users ?? [];
    const match = users.find((user: AuthUserSummary) =>
      user.email?.toLowerCase() === normalizedEmail
    );
    if (match) return match;
    if (users.length < 100) return null;
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 8192) {
    return jsonResponse({ error: "Request body is too large" }, 413);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return jsonResponse({
        error: "Server is missing required Supabase secrets",
      }, 500);
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      db: { schema: "carletonlodge" },
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: "carletonlodge" },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: canManage, error: permissionError } = await supabaseUser.rpc(
      "has_admin_section_permission",
      { target_section: "members", access_level: "write" },
    );

    if (permissionError || canManage !== true) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const actorLimit = await consumeRateLimit(
      supabaseAdmin,
      "member-login:user",
      user.id,
      20,
      60 * 60,
    );
    if (!actorLimit.allowed) {
      return jsonResponse({
        error: "Too many account-email requests. Please try again later.",
      }, 429);
    }

    let body: RequestBody;
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const memberId = body.memberId?.trim();
    const email = body.email?.trim().toLowerCase();
    const requestId = body.requestId?.trim().toLowerCase();

    if (!memberId) return jsonResponse({ error: "memberId is required" }, 400);
    if (!email) return jsonResponse({ error: "email is required" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "A valid email address is required" }, 400);
    }
    if (
      !requestId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        .test(requestId)
    ) {
      return jsonResponse({ error: "A valid requestId is required" }, 400);
    }

    const idempotencyKey = `member-account-access:${memberId}:${requestId}`;
    const { data: existingRequest, error: existingRequestError } =
      await supabaseAdmin
        .from("notification_outbox")
        .select("id, status")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

    if (existingRequestError) throw existingRequestError;
    if (existingRequest) {
      return jsonResponse({
        queued: true,
        duplicate: true,
        notificationId: existingRequest.id,
        notificationStatus: existingRequest.status,
      });
    }

    const { data: recentEmail, error: recentEmailError } = await supabaseAdmin
      .from("notification_outbox")
      .select("id")
      .eq("notification_type", "member_account_invitation")
      .eq("recipient_email", email)
      .in("status", ["queued", "processing", "sent"])
      .gte("created_at", new Date(Date.now() - 60_000).toISOString())
      .limit(1)
      .maybeSingle();

    if (recentEmailError) throw recentEmailError;
    if (recentEmail) {
      return jsonResponse({
        error:
          "An account access email was sent to this address recently. Wait one minute before sending another.",
      }, 429);
    }

    const { data: member, error: memberError } = await supabaseAdmin
      .from("lodge_members")
      .select("id, full_name, linked_profile_id, email")
      .eq("id", memberId)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!member) return jsonResponse({ error: "Member not found" }, 404);

    let authUserId = member.linked_profile_id as string | null;
    let existingAuthUser: AuthUserSummary | null = null;
    let created = false;

    if (authUserId) {
      const { data: linkedUser, error: linkedUserError } = await supabaseAdmin
        .auth.admin.getUserById(authUserId);
      if (linkedUserError) throw linkedUserError;
      existingAuthUser = linkedUser.user as AuthUserSummary | null;
    }

    if (!authUserId) {
      existingAuthUser = await findAuthUserByEmail(supabaseAdmin, email);
      authUserId = existingAuthUser?.id ?? null;
    }

    if (authUserId) {
      const { data: linkedElsewhere, error: linkedElsewhereError } =
        await supabaseAdmin
          .from("lodge_members")
          .select("id, full_name")
          .eq("linked_profile_id", authUserId)
          .neq("id", member.id)
          .limit(1)
          .maybeSingle();

      if (linkedElsewhereError) throw linkedElsewhereError;
      if (linkedElsewhere) {
        return jsonResponse({
          error:
            `This email is already linked to ${linkedElsewhere.full_name}. Each member needs a unique login email.`,
        }, 409);
      }
    }

    if (authUserId) {
      const { error: updateAuthError } = await supabaseAdmin.auth.admin
        .updateUserById(authUserId, {
          email,
          email_confirm: true,
          user_metadata: {
            ...(existingAuthUser?.user_metadata ?? {}),
            force_password_change: true,
          },
        });
      if (updateAuthError) throw updateAuthError;
    } else {
      const { data: createdUser, error: createAuthError } = await supabaseAdmin
        .auth.admin.createUser({
          email,
          password: createUnknownPassword(),
          email_confirm: true,
          user_metadata: { force_password_change: true },
        });
      if (createAuthError) throw createAuthError;
      authUserId = createdUser.user?.id ?? null;
      created = true;
    }

    if (!authUserId) {
      return jsonResponse(
        { error: "Could not create or update auth user" },
        500,
      );
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: authUserId,
        email,
        force_password_change: true,
        updated_at: new Date().toISOString(),
      });
    if (profileError) throw profileError;

    const { error: memberUpdateError } = await supabaseAdmin
      .from("lodge_members")
      .update({
        email,
        linked_profile_id: authUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId);
    if (memberUpdateError) throw memberUpdateError;

    const [{ data: profile, error: profileReadError }, {
      data: permissions,
      error: permissionsError,
    }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("is_admin")
        .eq("id", authUserId)
        .single(),
      supabaseAdmin
        .from("admin_section_permissions")
        .select("section, can_read, can_write, can_approve")
        .eq("profile_id", authUserId),
    ]);

    if (profileReadError) throw profileReadError;
    if (permissionsError) throw permissionsError;

    const permissionSummary = describePermissions(
      profile.is_admin === true,
      (permissions ?? []) as SectionPermission[],
    );

    const { data: notification, error: notificationError } = await supabaseAdmin
      .from("notification_outbox")
      .insert({
        notification_type: "member_account_invitation",
        recipient_profile_id: authUserId,
        recipient_email: email,
        payload: {
          member_id: member.id,
          profile_id: authUserId,
          member_name: member.full_name,
          account_created: created,
          permissions: permissionSummary,
          requested_by_profile_id: user.id,
        },
        idempotency_key: idempotencyKey,
        max_attempts: 1,
      })
      .select("id, status")
      .single();

    if (notificationError) throw notificationError;

    return jsonResponse({
      created,
      profileId: authUserId,
      email,
      memberName: member.full_name,
      forcePasswordChange: true,
      queued: true,
      notificationId: notification.id,
      notificationStatus: notification.status,
    });
  } catch (error) {
    console.error("manage-member-login error:", error);
    const message = error instanceof Error
      ? error.message
      : typeof (error as { message?: unknown })?.message === "string"
      ? (error as { message: string }).message
      : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
});
