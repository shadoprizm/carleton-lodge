import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.110.8";
import { mailboxBaseName } from "../_shared/mailbox-address.ts";
import {
  createMxrouteProvider,
  createProviderLockPassword,
  LODGE_EMAIL_DOMAIN,
  mailboxProviderStatusJson,
  type ProviderMailboxStatus,
} from "../_shared/lodge-email-provider.ts";
import { consumeRateLimit } from "../_shared/rate-limit.ts";

// The project has no generated Edge Function database type yet; keep the
// schema-aware client usable until Supabase types are generated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LodgeSupabaseClient = SupabaseClient<any, any, any, any, any>;

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

type MailboxStatus =
  | "unprovisioned"
  | "provisioning"
  | "pending_activation"
  | "active"
  | "error"
  | "suspended";

type RosterMember = {
  id: string;
  full_name: string;
  linked_profile_id: string | null;
  email: string | null;
  lodge_email: string | null;
  mailbox_status: MailboxStatus;
  mailbox_quota_mb: number;
  mailbox_send_limit: number;
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

async function reserveLodgeEmail(
  supabaseAdmin: LodgeSupabaseClient,
  member: RosterMember,
) {
  if (member.lodge_email && member.mailbox_status === "active") {
    return member.lodge_email;
  }

  const baseName = mailboxBaseName(member.full_name).slice(0, 48);
  for (let suffix = 1; suffix <= 100; suffix += 1) {
    const localPart = suffix === 1 ? baseName : `${baseName}${suffix}`;
    const candidate = `${localPart}@${LODGE_EMAIL_DOMAIN}`;
    const [
      { data: existing, error },
      { data: governedAccount, error: accountError },
    ] = await Promise.all([
      supabaseAdmin
        .from("lodge_members")
        .select("id")
        .eq("lodge_email", candidate)
        .maybeSingle(),
      supabaseAdmin
        .from("lodge_email_accounts")
        .select("associated_member_id")
        .ilike("address", candidate)
        .maybeSingle(),
    ]);

    if (error) throw error;
    if (accountError) throw accountError;
    const usedByAnotherMember = existing && existing.id !== member.id;
    const governedByAnotherMember = governedAccount &&
      governedAccount.associated_member_id !== member.id;
    if (!usedByAnotherMember && !governedByAnotherMember) return candidate;
  }

  throw new Error("Could not reserve a unique lodge email address");
}

const mxroute = createMxrouteProvider();

async function getMxrouteMailbox(lodgeEmail: string) {
  return await mxroute.getMailbox(lodgeEmail);
}

async function retireUnactivatedMxrouteMailbox(lodgeEmail: string) {
  const account = await getMxrouteMailbox(lodgeEmail);
  if (!account) return;

  if ((account.sentToday ?? 0) > 0) {
    throw new Error(
      `The existing mailbox ${lodgeEmail} has sent mail and cannot be replaced automatically.`,
    );
  }

  await mxroute.deleteMailbox(lodgeEmail);
}

async function ensureMxrouteMailbox(
  lodgeEmail: string,
  quota: number,
  sendLimit: number,
): Promise<ProviderMailboxStatus> {
  const existing = await mxroute.getMailbox(lodgeEmail);
  if (existing) return existing;
  return await mxroute.createMailbox({
    address: lodgeEmail,
    password: createProviderLockPassword(),
    quotaMb: quota,
    dailySendLimit: sendLimit,
  });
}

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
    const result = await response.json().catch(() => null) as {
      error?: unknown;
    } | null;
    throw new Error(
      typeof result?.error === "string"
        ? result.error
        : `Notification processor returned HTTP ${response.status}`,
    );
  }
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
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
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
        .select("id, status, provisioned_at, activated_at")
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
      .select(
        "id, full_name, linked_profile_id, email, lodge_email, mailbox_status, mailbox_quota_mb, mailbox_send_limit",
      )
      .eq("id", memberId)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!member) return jsonResponse({ error: "Member not found" }, 404);

    const rosterMember = member as RosterMember;

    let authUserId = rosterMember.linked_profile_id;
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
          .neq("id", rosterMember.id)
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

    const lodgeEmail = await reserveLodgeEmail(supabaseAdmin, rosterMember);
    const mailboxAlreadyActive = rosterMember.mailbox_status === "active";
    const previousLodgeEmail = rosterMember.lodge_email;
    const correctingUnactivatedMailbox = !!previousLodgeEmail &&
      previousLodgeEmail !== lodgeEmail && !mailboxAlreadyActive;
    let providerMailboxStatus = mailboxAlreadyActive
      ? await getMxrouteMailbox(lodgeEmail)
      : null;

    if (!mailboxAlreadyActive) {
      if (correctingUnactivatedMailbox && previousLodgeEmail) {
        const previousMailbox = await getMxrouteMailbox(previousLodgeEmail);
        if (
          previousMailbox &&
          (previousMailbox.sentToday ?? 0) > 0
        ) {
          return jsonResponse({
            error:
              `The existing mailbox ${previousLodgeEmail} has sent mail and must be reviewed before it can be renamed.`,
          }, 409);
        }
      }

      const { error: provisioningStateError } = await supabaseAdmin
        .from("lodge_members")
        .update({
          lodge_email: lodgeEmail,
          mailbox_status: "provisioning",
          updated_at: new Date().toISOString(),
        })
        .eq("id", memberId);
      if (provisioningStateError) throw provisioningStateError;

      try {
        providerMailboxStatus = await ensureMxrouteMailbox(
          lodgeEmail,
          rosterMember.mailbox_quota_mb,
          rosterMember.mailbox_send_limit,
        );
        if (correctingUnactivatedMailbox && previousLodgeEmail) {
          await retireUnactivatedMxrouteMailbox(previousLodgeEmail);
        }
      } catch (mailboxError) {
        await supabaseAdmin
          .from("lodge_members")
          .update({
            lodge_email: lodgeEmail,
            mailbox_status: "error",
            updated_at: new Date().toISOString(),
          })
          .eq("id", memberId);
        throw mailboxError;
      }
    }

    const { error: memberUpdateError } = await supabaseAdmin
      .from("lodge_members")
      .update({
        email,
        linked_profile_id: authUserId,
        lodge_email: lodgeEmail,
        ...(mailboxAlreadyActive ? {} : {
          mailbox_status: "pending_activation",
          mailbox_provisioned_at: new Date().toISOString(),
        }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId);
    if (memberUpdateError) throw memberUpdateError;

    const now = new Date().toISOString();
    const { data: existingGovernedAccount, error: governedAccountReadError } =
      await supabaseAdmin
        .from("lodge_email_accounts")
        .select("id, status, provisioned_at, activated_at")
        .eq("associated_member_id", memberId)
        .maybeSingle();
    if (governedAccountReadError) throw governedAccountReadError;

    const governedAccountValues = {
      address: lodgeEmail,
      account_type: "MEMBER",
      status: existingGovernedAccount?.status === "ACTIVE"
        ? "ACTIVE"
        : "TERMS_PENDING",
      provider: "mxroute",
      provider_mailbox_identifier: lodgeEmail,
      associated_member_id: memberId,
      position_id: null,
      current_authorized_member_id: null,
      display_name: rosterMember.full_name,
      enabled: true,
      agreement_required: true,
      credential_status: mailboxAlreadyActive
        ? "USER_SET"
        : "PROVISIONED_LOCKED",
      provider_status: providerMailboxStatus
        ? mailboxProviderStatusJson(providerMailboxStatus)
        : {},
      provisioned_at: existingGovernedAccount?.provisioned_at ?? now,
      activated_at: mailboxAlreadyActive
        ? existingGovernedAccount?.activated_at ?? now
        : null,
      updated_at: now,
    };

    let governedAccountId = existingGovernedAccount?.id ?? null;
    if (governedAccountId) {
      const { error: governedAccountUpdateError } = await supabaseAdmin
        .from("lodge_email_accounts")
        .update(governedAccountValues)
        .eq("id", governedAccountId);
      if (governedAccountUpdateError) throw governedAccountUpdateError;
    } else {
      const {
        data: createdGovernedAccount,
        error: governedAccountInsertError,
      } = await supabaseAdmin
        .from("lodge_email_accounts")
        .insert(governedAccountValues)
        .select("id")
        .single();
      if (governedAccountInsertError) throw governedAccountInsertError;
      governedAccountId = createdGovernedAccount.id;
    }

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
          member_id: rosterMember.id,
          profile_id: authUserId,
          member_name: rosterMember.full_name,
          email_account_id: governedAccountId,
          lodge_email: lodgeEmail,
          mailbox_status: mailboxAlreadyActive
            ? "active"
            : "pending_activation",
          account_created: created,
          permissions: permissionSummary,
          requested_by_profile_id: user.id,
        },
        idempotency_key: idempotencyKey,
        max_attempts: 3,
      })
      .select("id, status")
      .single();

    if (notificationError) throw notificationError;

    const { error: auditError } = await supabaseAdmin
      .from("lodge_email_audit_events")
      .insert([
        {
          event_type: "MAILBOX_PROVISIONED",
          email_account_id: governedAccountId,
          member_id: memberId,
          actor_profile_id: user.id,
          outcome: "SUCCESS",
          details: {
            provider: "mxroute",
            mailbox_preserved: mailboxAlreadyActive,
          },
        },
        {
          event_type: "ACTIVATION_INVITATION_QUEUED",
          email_account_id: governedAccountId,
          member_id: memberId,
          actor_profile_id: user.id,
          outcome: "SUCCESS",
          details: { notification_id: notification.id },
        },
      ]);
    if (auditError) throw auditError;

    let deliveryStatus = notification.status;
    try {
      await processNotificationQueue(supabaseUrl, supabaseServiceKey);
      const { data: deliveredNotification, error: deliveryReadError } =
        await supabaseAdmin
          .from("notification_outbox")
          .select("status")
          .eq("id", notification.id)
          .single();
      if (deliveryReadError) throw deliveryReadError;
      deliveryStatus = deliveredNotification.status;
    } catch (deliveryError) {
      console.error(
        "Member welcome email remains queued:",
        deliveryError instanceof Error
          ? deliveryError.message
          : "Unknown error",
      );
    }

    return jsonResponse({
      created,
      profileId: authUserId,
      email,
      lodgeEmail,
      mailboxStatus: mailboxAlreadyActive ? "active" : "pending_activation",
      memberName: rosterMember.full_name,
      forcePasswordChange: true,
      queued: true,
      notificationId: notification.id,
      notificationStatus: deliveryStatus,
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
