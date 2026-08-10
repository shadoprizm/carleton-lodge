import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.110.8";
import {
  contentLengthExceeds,
  handlePreflight,
  jsonResponse,
  rejectDisallowedOrigin,
} from "../_shared/http-security.ts";
import {
  createMxrouteProvider,
  createProviderLockPassword,
  LODGE_EMAIL_SETUP,
  mailboxProviderStatusJson,
  normalizeLodgeEmailAddress,
} from "../_shared/lodge-email-provider.ts";
import { consumeRateLimit } from "../_shared/rate-limit.ts";

const minMailboxPasswordLength = 8;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// The project has no generated Edge Function database type yet; keep the
// schema-aware client usable until Supabase types are generated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LodgeSupabaseClient = SupabaseClient<any, any, any, any, any>;

type RequestBody = {
  action?: unknown;
  accountId?: unknown;
  incomingMemberId?: unknown;
  reason?: unknown;
  confirmed?: unknown;
  requestId?: unknown;
  token?: unknown;
  password?: unknown;
  agreementAccepted?: unknown;
  policyVersionId?: unknown;
  positionId?: unknown;
  address?: unknown;
  displayName?: unknown;
  accountType?: unknown;
  enabled?: unknown;
  agreementRequired?: unknown;
  policyType?: unknown;
  title?: unknown;
  content?: unknown;
  acknowledgement?: unknown;
  effectiveAt?: unknown;
  requiresReacceptance?: unknown;
};

type RoleAccount = {
  id: string;
  address: string;
  account_type: "OFFICER" | "FUNCTIONAL";
  status: string;
  position_id: string;
  current_authorized_member_id: string | null;
  display_name: string;
  agreement_required: boolean;
  credential_status: string;
  provisioned_at: string | null;
};

type LodgeMember = {
  id: string;
  full_name: string;
  email: string | null;
  linked_profile_id: string | null;
};

function validatePassword(password: string) {
  if (password.length < minMailboxPasswordLength) {
    return `Use at least ${minMailboxPasswordLength} characters.`;
  }
  if (password.length > 128) return "Use no more than 128 characters.";
  if (!/[a-z]/.test(password)) return "Add at least one lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Add at least one uppercase letter.";
  if (!/[0-9]/.test(password)) return "Add at least one number.";
  if (/\r|\n/.test(password)) return "The password cannot contain a line break.";
  return "";
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function processNotificationQueue(supabaseUrl: string, serviceRoleKey: string) {
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
    const result = await response.json().catch(() => null) as { error?: unknown } | null;
    throw new Error(
      typeof result?.error === "string"
        ? result.error
        : `Notification processor returned HTTP ${response.status}`,
    );
  }
}

async function requireMemberWrite(supabaseUser: LodgeSupabaseClient) {
  const { data, error } = await supabaseUser.rpc("has_admin_section_permission", {
    target_section: "members",
    access_level: "write",
  });
  return !error && data === true;
}

async function getRoleAccount(supabaseAdmin: LodgeSupabaseClient, accountId: string) {
  const { data, error } = await supabaseAdmin
    .from("lodge_email_accounts")
    .select("id, address, account_type, status, position_id, current_authorized_member_id, display_name, agreement_required, credential_status, provisioned_at")
    .eq("id", accountId)
    .in("account_type", ["OFFICER", "FUNCTIONAL"])
    .maybeSingle();
  if (error) throw error;
  return data as RoleAccount | null;
}

async function getMember(supabaseAdmin: LodgeSupabaseClient, memberId: string) {
  const { data, error } = await supabaseAdmin
    .from("lodge_members")
    .select("id, full_name, email, linked_profile_id")
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw error;
  return data as LodgeMember | null;
}

async function queueAccountEmail(
  supabaseAdmin: LodgeSupabaseClient,
  input: {
    notificationType: "role_mailbox_invitation" | "email_account_password_reset" | "email_account_activation_confirmation";
    recipient: LodgeMember;
    account: { id: string; address: string; display_name: string; account_type: string; position_id?: string | null };
    idempotencyKey: string;
    handoverId?: string | null;
    purpose?: "ROLE_ACTIVATION" | "PASSWORD_RESET";
  },
) {
  if (!input.recipient.email || !input.recipient.linked_profile_id) {
    throw new Error("The member needs a verified personal email and linked website account first");
  }

  const { data, error } = await supabaseAdmin
    .from("notification_outbox")
    .insert({
      notification_type: input.notificationType,
      recipient_profile_id: input.recipient.linked_profile_id,
      recipient_email: input.recipient.email.toLowerCase(),
      payload: {
        email_account_id: input.account.id,
        lodge_email: input.account.address,
        account_type: input.account.account_type,
        display_name: input.account.display_name,
        position_id: input.account.position_id ?? null,
        member_id: input.recipient.id,
        member_name: input.recipient.full_name,
        handover_id: input.handoverId ?? null,
        token_purpose: input.purpose ?? null,
      },
      idempotency_key: input.idempotencyKey,
      max_attempts: 3,
    })
    .select("id, status")
    .single();
  if (error) throw error;
  return data;
}

async function insertAudit(
  supabaseAdmin: LodgeSupabaseClient,
  event: {
    event_type: string;
    email_account_id?: string | null;
    member_id?: string | null;
    position_id?: string | null;
    handover_id?: string | null;
    actor_profile_id?: string | null;
    outcome?: "SUCCESS" | "FAILURE" | "WARNING";
    details?: Record<string, unknown>;
  },
) {
  const { error } = await supabaseAdmin.from("lodge_email_audit_events").insert({
    ...event,
    outcome: event.outcome ?? "SUCCESS",
    details: event.details ?? {},
  });
  if (error) throw error;
}

async function syncRoleAccount(
  supabaseAdmin: LodgeSupabaseClient,
  actorId: string,
  account: RoleAccount,
) {
  const provider = createMxrouteProvider();
  let providerAccount = await provider.getMailbox(account.address);
  const existed = providerAccount !== null;
  if (!providerAccount) {
    providerAccount = await provider.createMailbox({
      address: account.address,
      password: createProviderLockPassword(),
      quotaMb: 500,
      dailySendLimit: 200,
    });
  }

  const now = new Date().toISOString();
  const nextStatus = account.current_authorized_member_id
    ? "INVITATION_PENDING"
    : "PASSWORD_SETUP_PENDING";
  const { error } = await supabaseAdmin
    .from("lodge_email_accounts")
    .update({
      status: nextStatus,
      credential_status: existed ? account.credential_status : "PROVISIONED_LOCKED",
      provider_mailbox_identifier: account.address,
      provider_status: mailboxProviderStatusJson(providerAccount),
      provisioned_at: account.provisioned_at ?? now,
      updated_at: now,
    })
    .eq("id", account.id);
  if (error) throw error;

  await insertAudit(supabaseAdmin, {
    event_type: existed ? "ROLE_MAILBOX_VERIFIED" : "ROLE_MAILBOX_PROVISIONED",
    email_account_id: account.id,
    member_id: account.current_authorized_member_id,
    position_id: account.position_id,
    actor_profile_id: actorId,
    details: { provider: "mxroute", existing_mailbox_preserved: existed },
  });

  return { existed, providerAccount };
}

async function prepareRoleInvitation(
  supabaseAdmin: LodgeSupabaseClient,
  supabaseUrl: string,
  serviceRoleKey: string,
  actorId: string,
  account: RoleAccount,
  member: LodgeMember,
  requestId: string,
  handoverId: string | null,
) {
  if (!member.email || !member.linked_profile_id) {
    throw new Error("The incoming holder needs a verified personal email and linked website account first");
  }

  const provider = createMxrouteProvider();
  const providerAccount = await provider.getMailbox(account.address);
  if (!providerAccount) throw new Error("Provision the role mailbox before sending an invitation");

  await provider.updateMailbox(account.address, { password: createProviderLockPassword() });
  const now = new Date().toISOString();

  const { data: existingAssignment, error: assignmentReadError } = await supabaseAdmin
    .from("officer_mailbox_assignments")
    .select("id")
    .eq("email_account_id", account.id)
    .eq("member_id", member.id)
    .in("status", ["PENDING", "ACTIVE"])
    .maybeSingle();
  if (assignmentReadError) throw assignmentReadError;

  if (existingAssignment) {
    const { error } = await supabaseAdmin
      .from("officer_mailbox_assignments")
      .update({
        status: "PENDING",
        assignment_end: null,
        handover_id: handoverId,
        assigned_by: actorId,
        updated_at: now,
      })
      .eq("id", existingAssignment.id);
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin
      .from("officer_mailbox_assignments")
      .insert({
        email_account_id: account.id,
        position_id: account.position_id,
        member_id: member.id,
        status: "PENDING",
        handover_id: handoverId,
        assigned_by: actorId,
        reason: handoverId ? "Officer mailbox handover" : "Initial role mailbox activation",
      });
    if (error) throw error;
  }

  const { error: accountUpdateError } = await supabaseAdmin
    .from("lodge_email_accounts")
    .update({
      current_authorized_member_id: member.id,
      status: "INVITATION_PENDING",
      credential_status: "ROTATED",
      last_credential_rotation_at: now,
      updated_at: now,
    })
    .eq("id", account.id);
  if (accountUpdateError) throw accountUpdateError;

  const notification = await queueAccountEmail(supabaseAdmin, {
    notificationType: "role_mailbox_invitation",
    recipient: member,
    account,
    idempotencyKey: `role-mailbox-invitation:${account.id}:${requestId}`,
    handoverId,
    purpose: "ROLE_ACTIVATION",
  });

  if (handoverId) {
    const { error } = await supabaseAdmin
      .from("officer_email_handovers")
      .update({
        state: "WAITING_FOR_ACCEPTANCE",
        credentials_rotated_at: now,
        incoming_invited_at: now,
        failure_step: null,
        failure_message: null,
        updated_at: now,
      })
      .eq("id", handoverId);
    if (error) throw error;
  }

  await insertAudit(supabaseAdmin, {
    event_type: "ROLE_CREDENTIALS_ROTATED_AND_INVITATION_QUEUED",
    email_account_id: account.id,
    member_id: member.id,
    position_id: account.position_id,
    handover_id: handoverId,
    actor_profile_id: actorId,
    details: {
      provider: "mxroute",
      notification_id: notification.id,
      provider_session_revocation_supported: false,
    },
  });

  try {
    await processNotificationQueue(supabaseUrl, serviceRoleKey);
  } catch (error) {
    console.error(
      "Role mailbox invitation remains queued:",
      error instanceof Error ? error.message : "Unknown error",
    );
  }

  return notification;
}

async function completeAccountAction(
  req: Request,
  supabaseAdmin: LodgeSupabaseClient,
  supabaseUrl: string,
  serviceRoleKey: string,
  actorId: string,
  member: LodgeMember,
  body: RequestBody,
) {
  const rawToken = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (rawToken.length < 32 || rawToken.length > 256) {
    return jsonResponse(req, { error: "This secure email link is invalid" }, 400);
  }
  const passwordError = validatePassword(password);
  if (passwordError) return jsonResponse(req, { error: passwordError }, 400);

  const tokenHash = await sha256(rawToken);
  const { data: actionToken, error: tokenError } = await supabaseAdmin
    .from("email_account_action_tokens")
    .select("id, purpose, email_account_id, member_id, handover_id, expires_at, consumed_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (tokenError) throw tokenError;
  if (!actionToken || actionToken.member_id !== member.id || actionToken.consumed_at || actionToken.revoked_at) {
    return jsonResponse(req, { error: "This secure email link is invalid or has already been used" }, 400);
  }
  if (new Date(actionToken.expires_at).getTime() <= Date.now()) {
    return jsonResponse(req, { error: "This secure email link has expired. Request a new one." }, 400);
  }

  const { data: account, error: accountError } = await supabaseAdmin
    .from("lodge_email_accounts")
    .select("id, address, account_type, status, position_id, associated_member_id, current_authorized_member_id, agreement_required, activated_at")
    .eq("id", actionToken.email_account_id)
    .maybeSingle();
  if (accountError) throw accountError;
  if (!account) return jsonResponse(req, { error: "The Lodge mailbox no longer exists" }, 404);

  const isPersonalOwner = account.account_type === "MEMBER" &&
    account.associated_member_id === member.id;
  const isCurrentRoleHolder = account.account_type !== "MEMBER" &&
    account.current_authorized_member_id === member.id;
  if (!isPersonalOwner && !isCurrentRoleHolder) {
    return jsonResponse(req, { error: "You are no longer authorized for this mailbox" }, 403);
  }
  if (["SUSPENDED", "DISABLED", "ERROR", "NOT_PROVISIONED", "PROVISIONING"].includes(account.status)) {
    return jsonResponse(req, { error: "This mailbox is not currently available" }, 409);
  }

  const policyType = account.account_type === "MEMBER"
    ? "MEMBER_EMAIL_TERMS"
    : "OFFICER_EMAIL_AGREEMENT";
  const { data: policy, error: policyError } = await supabaseAdmin
    .from("email_policy_versions")
    .select("id, version, requires_reacceptance")
    .eq("policy_type", policyType)
    .eq("is_active", true)
    .lte("effective_at", new Date().toISOString())
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (policyError) throw policyError;
  if (!policy) return jsonResponse(req, { error: "The required email agreement is unavailable" }, 503);

  const { data: currentAcceptance, error: acceptanceReadError } = await supabaseAdmin
    .from("email_agreement_acceptances")
    .select("id")
    .eq("member_id", member.id)
    .eq("email_account_id", account.id)
    .eq("policy_version_id", policy.id)
    .maybeSingle();
  if (acceptanceReadError) throw acceptanceReadError;
  let acceptance = currentAcceptance;
  if (!acceptance && policy.requires_reacceptance === false) {
    const { data: priorAcceptance, error: priorAcceptanceError } = await supabaseAdmin
      .from("email_agreement_acceptances")
      .select("id")
      .eq("member_id", member.id)
      .eq("email_account_id", account.id)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (priorAcceptanceError) throw priorAcceptanceError;
    acceptance = priorAcceptance;
  }

  const needsAgreement = account.agreement_required && !acceptance;
  const policyVersionId = typeof body.policyVersionId === "string" ? body.policyVersionId : "";
  if (needsAgreement && (body.agreementAccepted !== true || policyVersionId !== policy.id)) {
    return jsonResponse(
      req,
      { error: "You must read and accept the current email agreement before continuing." },
      400,
    );
  }

  if (account.account_type !== "MEMBER") {
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("officer_mailbox_assignments")
      .select("id, status")
      .eq("email_account_id", account.id)
      .eq("member_id", member.id)
      .in("status", actionToken.purpose === "ROLE_ACTIVATION" ? ["PENDING"] : ["ACTIVE"])
      .maybeSingle();
    if (assignmentError) throw assignmentError;
    if (!assignment) {
      return jsonResponse(req, { error: "Your role-mailbox assignment is no longer current" }, 403);
    }
  }

  // Claim the token before the provider operation so concurrent/replayed
  // requests cannot both change the mailbox password. A provider failure
  // releases the claim; a successful password change permanently consumes it.
  const tokenClaimedAt = new Date().toISOString();
  const { data: claimedToken, error: tokenClaimError } = await supabaseAdmin
    .from("email_account_action_tokens")
    .update({ consumed_at: tokenClaimedAt })
    .eq("id", actionToken.id)
    .is("consumed_at", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (tokenClaimError) throw tokenClaimError;
  if (!claimedToken) {
    return jsonResponse(req, { error: "This secure email link is invalid or has already been used" }, 400);
  }

  const provider = createMxrouteProvider();
  try {
    const providerAccount = await provider.getMailbox(account.address);
    if (!providerAccount) throw new Error("The MXroute mailbox does not exist");
    await provider.updateMailbox(account.address, { password });
  } catch (providerError) {
    await supabaseAdmin
      .from("email_account_action_tokens")
      .update({ consumed_at: null })
      .eq("id", actionToken.id)
      .eq("consumed_at", tokenClaimedAt);
    await insertAudit(supabaseAdmin, {
      event_type: "MAILBOX_PASSWORD_PROVIDER_UPDATE_FAILED",
      email_account_id: account.id,
      member_id: member.id,
      position_id: account.position_id,
      handover_id: actionToken.handover_id,
      actor_profile_id: actorId,
      outcome: "FAILURE",
      details: {
        provider: "mxroute",
        purpose: actionToken.purpose,
        token_released_for_retry: true,
      },
    });
    if (providerError instanceof Error && providerError.message === "The MXroute mailbox does not exist") {
      return jsonResponse(req, { error: providerError.message }, 409);
    }
    throw providerError;
  }

  const now = new Date().toISOString();
  if (needsAgreement) {
    const { error } = await supabaseAdmin.from("email_agreement_acceptances").insert({
      member_id: member.id,
      email_account_id: account.id,
      position_id: account.position_id,
      policy_version_id: policy.id,
      acknowledgement_state: true,
      accepted_by_profile_id: actorId,
      audit_metadata: {
        source: actionToken.purpose === "ROLE_ACTIVATION"
          ? "officer_activation"
          : "password_reset",
      },
    });
    if (error) throw error;
  }

  if (account.account_type !== "MEMBER") {
    const { error } = await supabaseAdmin
      .from("officer_mailbox_assignments")
      .update({ status: "ACTIVE", assignment_end: null, updated_at: now })
      .eq("email_account_id", account.id)
      .eq("member_id", member.id)
      .in("status", ["PENDING", "ACTIVE"]);
    if (error) throw error;
  }

  const latestProvider = await provider.getMailbox(account.address);
  const { error: accountUpdateError } = await supabaseAdmin
    .from("lodge_email_accounts")
    .update({
      status: "ACTIVE",
      credential_status: "USER_SET",
      activated_at: account.activated_at ?? now,
      last_credential_rotation_at: now,
      provider_status: latestProvider ? mailboxProviderStatusJson(latestProvider) : {},
      updated_at: now,
    })
    .eq("id", account.id);
  if (accountUpdateError) throw accountUpdateError;

  if (actionToken.handover_id && actionToken.purpose === "ROLE_ACTIVATION") {
    const { error } = await supabaseAdmin
      .from("officer_email_handovers")
      .update({
        state: "ACTIVE",
        incoming_accepted_at: needsAgreement ? now : undefined,
        incoming_activated_at: now,
        completed_at: now,
        updated_at: now,
      })
      .eq("id", actionToken.handover_id)
      .eq("incoming_member_id", member.id);
    if (error) throw error;

    await supabaseAdmin
      .from("lodge_email_accounts")
      .update({ last_handover_at: now, updated_at: now })
      .eq("id", account.id);
  }

  await insertAudit(supabaseAdmin, {
    event_type: actionToken.purpose === "ROLE_ACTIVATION"
      ? "ROLE_MAILBOX_ACTIVATED"
      : "MAILBOX_PASSWORD_RESET_COMPLETED",
    email_account_id: account.id,
    member_id: member.id,
    position_id: account.position_id,
    handover_id: actionToken.handover_id,
    actor_profile_id: actorId,
    details: {
      provider: "mxroute",
      agreement_accepted: needsAgreement,
      policy_version_id: policy.id,
    },
  });

  try {
    await queueAccountEmail(supabaseAdmin, {
      notificationType: "email_account_activation_confirmation",
      recipient: member,
      account: {
        id: account.id,
        address: account.address,
        display_name: account.account_type === "MEMBER"
          ? "Personal Lodge email"
          : "Officer or functional",
        account_type: account.account_type,
        position_id: account.position_id,
      },
      idempotencyKey: `email-account-activation-confirmation:${actionToken.id}`,
      handoverId: actionToken.handover_id,
    });
    await processNotificationQueue(supabaseUrl, serviceRoleKey);
  } catch (confirmationError) {
    console.error(
      "Mailbox activation confirmation remains queued:",
      confirmationError instanceof Error ? confirmationError.message : "Unknown error",
    );
  }

  return jsonResponse(req, {
    completed: true,
    accountId: account.id,
    lodgeEmail: account.address,
    webmailUrl: LODGE_EMAIL_SETUP.webmailUrl,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handlePreflight(req);
  const originError = rejectDisallowedOrigin(req);
  if (originError) return originError;
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);
  if (contentLengthExceeds(req, 8192)) {
    return jsonResponse(req, { error: "Request body is too large" }, 413);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse(req, { error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(req, { error: "Server configuration is incomplete" }, 500);
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    db: { schema: "carletonlodge" },
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "carletonlodge" },
  });

  try {
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return jsonResponse(req, { error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => null) as RequestBody | null;
    const action = typeof body?.action === "string" ? body.action : "";
    const accountId = typeof body?.accountId === "string" ? body.accountId : "";
    if (!action) return jsonResponse(req, { error: "action is required" }, 400);

    const limit = await consumeRateLimit(
      supabaseAdmin,
      action.startsWith("admin_") ? "lodge-email-admin:user" : "lodge-email-member:user",
      user.id,
      action.startsWith("admin_") ? 40 : 15,
      60 * 60,
    );
    if (!limit.allowed) {
      return jsonResponse(req, { error: "Too many email-account requests. Please wait and try again." }, 429);
    }

    const { data: currentMemberData, error: currentMemberError } = await supabaseAdmin
      .from("lodge_members")
      .select("id, full_name, email, linked_profile_id")
      .eq("linked_profile_id", user.id)
      .maybeSingle();
    if (currentMemberError) throw currentMemberError;
    const currentMember = currentMemberData as LodgeMember | null;

    if (action === "complete_account_action") {
      if (!currentMember) {
        return jsonResponse(req, { error: "No verified Lodge member is linked to this account" }, 403);
      }
      return await completeAccountAction(
        req,
        supabaseAdmin,
        supabaseUrl,
        serviceRoleKey,
        user.id,
        currentMember,
        body ?? {},
      );
    }

    if (action === "request_password_reset") {
      if (!currentMember || !uuidPattern.test(accountId)) {
        return jsonResponse(req, { error: "A valid mailbox is required" }, 400);
      }
      const { data: account, error } = await supabaseAdmin
        .from("lodge_email_accounts")
        .select("id, address, account_type, display_name, position_id, associated_member_id, current_authorized_member_id, status")
        .eq("id", accountId)
        .maybeSingle();
      if (error) throw error;
      if (!account) return jsonResponse(req, { error: "Mailbox not found" }, 404);

      const personalOwner = account.account_type === "MEMBER" &&
        account.associated_member_id === currentMember.id;
      let roleHolder = account.account_type !== "MEMBER" &&
        account.current_authorized_member_id === currentMember.id;
      if (roleHolder) {
        const { data: assignment, error: assignmentError } = await supabaseAdmin
          .from("officer_mailbox_assignments")
          .select("id")
          .eq("email_account_id", account.id)
          .eq("member_id", currentMember.id)
          .eq("status", "ACTIVE")
          .maybeSingle();
        if (assignmentError) throw assignmentError;
        roleHolder = !!assignment;
      }
      if ((!personalOwner && !roleHolder) || account.status !== "ACTIVE") {
        return jsonResponse(req, { error: "You are not authorized to reset this mailbox" }, 403);
      }
      if (!currentMember.email || !currentMember.linked_profile_id) {
        return jsonResponse(req, { error: "A verified personal email is required" }, 409);
      }

      const requestId = typeof body?.requestId === "string" && uuidPattern.test(body.requestId)
        ? body.requestId
        : crypto.randomUUID();
      const notification = await queueAccountEmail(supabaseAdmin, {
        notificationType: "email_account_password_reset",
        recipient: currentMember,
        account,
        idempotencyKey: `email-account-password-reset:${account.id}:${requestId}`,
        purpose: "PASSWORD_RESET",
      });
      await insertAudit(supabaseAdmin, {
        event_type: "MAILBOX_PASSWORD_RESET_REQUESTED",
        email_account_id: account.id,
        member_id: currentMember.id,
        position_id: account.position_id,
        actor_profile_id: user.id,
        details: { notification_id: notification.id },
      });
      try {
        await processNotificationQueue(supabaseUrl, serviceRoleKey);
      } catch (error) {
        console.error(
          "Password reset email remains queued:",
          error instanceof Error ? error.message : "Unknown error",
        );
      }
      return jsonResponse(req, { queued: true, notificationId: notification.id });
    }

    if (!action.startsWith("admin_") || !await requireMemberWrite(supabaseUser)) {
      return jsonResponse(req, { error: "Forbidden" }, 403);
    }

    if (action === "admin_create_role_account") {
      const positionId = typeof body?.positionId === "string" ? body.positionId : "";
      const displayName = typeof body?.displayName === "string" ? body.displayName.trim().slice(0, 160) : "";
      const accountType = body?.accountType === "OFFICER" ? "OFFICER" : "FUNCTIONAL";
      const incomingMemberId = typeof body?.incomingMemberId === "string" && uuidPattern.test(body.incomingMemberId)
        ? body.incomingMemberId
        : null;
      if (!uuidPattern.test(positionId) || !displayName) {
        return jsonResponse(req, { error: "A Lodge position and display name are required" }, 400);
      }
      let address = "";
      try {
        address = normalizeLodgeEmailAddress(typeof body?.address === "string" ? body.address : "");
      } catch (error) {
        return jsonResponse(req, { error: error instanceof Error ? error.message : "A valid Lodge email is required" }, 400);
      }
      if (incomingMemberId) {
        const holder = await getMember(supabaseAdmin, incomingMemberId);
        if (!holder) return jsonResponse(req, { error: "The selected member was not found" }, 404);
      }
      const { data: createdAccount, error: createError } = await supabaseAdmin
        .from("lodge_email_accounts")
        .insert({
          address,
          account_type: accountType,
          status: "NOT_PROVISIONED",
          position_id: positionId,
          current_authorized_member_id: incomingMemberId,
          display_name: displayName,
          enabled: true,
          agreement_required: body?.agreementRequired !== false,
          credential_status: "UNKNOWN",
        })
        .select("id")
        .single();
      if (createError) throw createError;
      if (incomingMemberId) {
        const { error } = await supabaseAdmin.from("officer_mailbox_assignments").insert({
          email_account_id: createdAccount.id,
          position_id: positionId,
          member_id: incomingMemberId,
          status: "PENDING",
          assigned_by: user.id,
          reason: "Initial role mailbox configuration",
        });
        if (error) throw error;
      }
      await insertAudit(supabaseAdmin, {
        event_type: "ROLE_MAILBOX_CONFIGURED",
        email_account_id: createdAccount.id,
        member_id: incomingMemberId,
        position_id: positionId,
        actor_profile_id: user.id,
        details: { address, account_type: accountType },
      });
      return jsonResponse(req, { created: true, accountId: createdAccount.id });
    }

    if (action === "admin_create_policy_version") {
      const policyType = body?.policyType === "MEMBER_EMAIL_TERMS"
        ? "MEMBER_EMAIL_TERMS"
        : body?.policyType === "OFFICER_EMAIL_AGREEMENT"
        ? "OFFICER_EMAIL_AGREEMENT"
        : "";
      const title = typeof body?.title === "string" ? body.title.trim() : "";
      const content = typeof body?.content === "string" ? body.content.trim() : "";
      const acknowledgement = typeof body?.acknowledgement === "string"
        ? body.acknowledgement.trim()
        : "";
      const effectiveAt = typeof body?.effectiveAt === "string"
        ? new Date(body.effectiveAt)
        : new Date();
      if (!policyType || title.length < 5 || content.length < 100 || acknowledgement.length < 40 || Number.isNaN(effectiveAt.getTime())) {
        return jsonResponse(req, { error: "A complete policy, acknowledgement, and valid effective date are required" }, 400);
      }
      const { data: policyId, error } = await supabaseAdmin.rpc(
        "create_email_policy_version_internal",
        {
          target_policy_type: policyType,
          target_title: title,
          target_content: content,
          target_acknowledgement: acknowledgement,
          target_effective_at: effectiveAt.toISOString(),
          target_requires_reacceptance: body?.requiresReacceptance !== false,
          target_created_by: user.id,
        },
      );
      if (error) throw error;
      await insertAudit(supabaseAdmin, {
        event_type: "EMAIL_POLICY_VERSION_CREATED",
        actor_profile_id: user.id,
        details: {
          policy_id: policyId,
          policy_type: policyType,
          requires_reacceptance: body?.requiresReacceptance !== false,
        },
      });
      return jsonResponse(req, { created: true, policyId });
    }

    if (!uuidPattern.test(accountId)) {
      return jsonResponse(req, { error: "A valid accountId is required" }, 400);
    }

    if ([
      "admin_initiate_personal_password_reset",
      "admin_suspend_personal_account",
      "admin_reactivate_personal_account",
    ].includes(action)) {
      const { data: personalAccount, error: personalAccountError } = await supabaseAdmin
        .from("lodge_email_accounts")
        .select("id, address, account_type, status, associated_member_id, display_name")
        .eq("id", accountId)
        .eq("account_type", "MEMBER")
        .maybeSingle();
      if (personalAccountError) throw personalAccountError;
      if (!personalAccount?.associated_member_id) {
        return jsonResponse(req, { error: "Personal Lodge mailbox not found" }, 404);
      }
      const member = await getMember(supabaseAdmin, personalAccount.associated_member_id);
      if (!member) return jsonResponse(req, { error: "Mailbox member not found" }, 404);

      if (action === "admin_suspend_personal_account") {
        if (body?.confirmed !== true) {
          return jsonResponse(req, { error: "Explicit confirmation is required" }, 400);
        }
        const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
        if (!reason) return jsonResponse(req, { error: "A suspension reason is required" }, 400);
        const provider = createMxrouteProvider();
        await provider.updateMailbox(personalAccount.address, { password: createProviderLockPassword() });
        const now = new Date().toISOString();
        const { error } = await supabaseAdmin
          .from("lodge_email_accounts")
          .update({
            status: "SUSPENDED",
            credential_status: "ROTATED",
            suspended_at: now,
            last_credential_rotation_at: now,
            updated_at: now,
          })
          .eq("id", personalAccount.id);
        if (error) throw error;
        await supabaseAdmin
          .from("lodge_members")
          .update({ mailbox_status: "suspended", updated_at: now })
          .eq("id", member.id);
        await insertAudit(supabaseAdmin, {
          event_type: "MEMBER_MAILBOX_SUSPENDED",
          email_account_id: personalAccount.id,
          member_id: member.id,
          actor_profile_id: user.id,
          outcome: "WARNING",
          details: {
            reason,
            credentials_rotated: true,
            provider_native_suspend_supported: false,
            provider_session_revocation_supported: false,
          },
        });
        return jsonResponse(req, { suspended: true });
      }

      if (action === "admin_initiate_personal_password_reset" && personalAccount.status !== "ACTIVE") {
        return jsonResponse(req, { error: "Only an active mailbox can receive a standard password reset" }, 409);
      }

      const notification = await queueAccountEmail(supabaseAdmin, {
        notificationType: "email_account_password_reset",
        recipient: member,
        account: personalAccount,
        idempotencyKey: `${action}:${personalAccount.id}:${crypto.randomUUID()}`,
        purpose: "PASSWORD_RESET",
      });
      if (action === "admin_reactivate_personal_account") {
        const now = new Date().toISOString();
        const { error } = await supabaseAdmin
          .from("lodge_email_accounts")
          .update({ status: "PASSWORD_SETUP_PENDING", credential_status: "ROTATED", suspended_at: null, updated_at: now })
          .eq("id", personalAccount.id);
        if (error) throw error;
        await supabaseAdmin
          .from("lodge_members")
          .update({ mailbox_status: "pending_activation", updated_at: now })
          .eq("id", member.id);
      }
      await insertAudit(supabaseAdmin, {
        event_type: action === "admin_reactivate_personal_account"
          ? "MEMBER_MAILBOX_REACTIVATION_REQUESTED"
          : "ADMIN_MAILBOX_PASSWORD_RESET_INITIATED",
        email_account_id: personalAccount.id,
        member_id: member.id,
        actor_profile_id: user.id,
        details: { notification_id: notification.id },
      });
      try {
        await processNotificationQueue(supabaseUrl, serviceRoleKey);
      } catch (error) {
        console.error(
          "Personal mailbox recovery remains queued:",
          error instanceof Error ? error.message : "Unknown error",
        );
      }
      return jsonResponse(req, { queued: true, notificationId: notification.id });
    }

    const account = await getRoleAccount(supabaseAdmin, accountId);
    if (!account) return jsonResponse(req, { error: "Role mailbox not found" }, 404);

    if (action === "admin_sync_role_account") {
      const result = await syncRoleAccount(supabaseAdmin, user.id, account);
      return jsonResponse(req, {
        synced: true,
        existingMailboxPreserved: result.existed,
        providerStatus: mailboxProviderStatusJson(result.providerAccount),
      });
    }

    if (action === "admin_send_role_invitation") {
      if (!account.current_authorized_member_id) {
        return jsonResponse(req, { error: "Assign a member to this role before sending an invitation" }, 409);
      }
      const member = await getMember(supabaseAdmin, account.current_authorized_member_id);
      if (!member) return jsonResponse(req, { error: "Assigned member not found" }, 404);
      const requestId = typeof body?.requestId === "string" && uuidPattern.test(body.requestId)
        ? body.requestId
        : crypto.randomUUID();
      const notification = await prepareRoleInvitation(
        supabaseAdmin,
        supabaseUrl,
        serviceRoleKey,
        user.id,
        account,
        member,
        requestId,
        null,
      );
      return jsonResponse(req, { queued: true, notificationId: notification.id });
    }

    if (action === "admin_initiate_password_reset") {
      if (!account.current_authorized_member_id || account.status !== "ACTIVE") {
        return jsonResponse(req, { error: "Only an active current holder can receive a password reset" }, 409);
      }
      const member = await getMember(supabaseAdmin, account.current_authorized_member_id);
      if (!member) return jsonResponse(req, { error: "Assigned member not found" }, 404);
      const notification = await queueAccountEmail(supabaseAdmin, {
        notificationType: "email_account_password_reset",
        recipient: member,
        account,
        idempotencyKey: `admin-email-account-password-reset:${account.id}:${crypto.randomUUID()}`,
        purpose: "PASSWORD_RESET",
      });
      await insertAudit(supabaseAdmin, {
        event_type: "ADMIN_MAILBOX_PASSWORD_RESET_INITIATED",
        email_account_id: account.id,
        member_id: member.id,
        position_id: account.position_id,
        actor_profile_id: user.id,
        details: { notification_id: notification.id },
      });
      try {
        await processNotificationQueue(supabaseUrl, serviceRoleKey);
      } catch (error) {
        console.error(
          "Administrator password reset remains queued:",
          error instanceof Error ? error.message : "Unknown error",
        );
      }
      return jsonResponse(req, { queued: true, notificationId: notification.id });
    }

    if (action === "admin_update_role_configuration") {
      const displayName = typeof body?.displayName === "string" ? body.displayName.trim().slice(0, 160) : account.display_name;
      const enabled = typeof body?.enabled === "boolean" ? body.enabled : true;
      if (!enabled && account.current_authorized_member_id) {
        return jsonResponse(req, { error: "Vacate or suspend the assigned role before disabling its configuration" }, 409);
      }
      const { error } = await supabaseAdmin
        .from("lodge_email_accounts")
        .update({
          display_name: displayName || account.display_name,
          enabled,
          agreement_required: body?.agreementRequired !== false,
        })
        .eq("id", account.id);
      if (error) throw error;
      await insertAudit(supabaseAdmin, {
        event_type: "ROLE_MAILBOX_CONFIGURATION_UPDATED",
        email_account_id: account.id,
        member_id: account.current_authorized_member_id,
        position_id: account.position_id,
        actor_profile_id: user.id,
        details: { display_name: displayName || account.display_name, enabled, agreement_required: body?.agreementRequired !== false },
      });
      return jsonResponse(req, { updated: true });
    }

    if (action === "admin_initiate_handover") {
      if (body?.confirmed !== true) {
        return jsonResponse(req, { error: "Explicit handover confirmation is required" }, 400);
      }
      const incomingMemberId = typeof body?.incomingMemberId === "string"
        ? body.incomingMemberId
        : "";
      if (!uuidPattern.test(incomingMemberId)) {
        return jsonResponse(req, { error: "A valid incoming member is required" }, 400);
      }
      if (incomingMemberId === account.current_authorized_member_id) {
        return jsonResponse(req, { error: "The incoming member already holds this role mailbox" }, 409);
      }
      const incomingMember = await getMember(supabaseAdmin, incomingMemberId);
      if (!incomingMember?.email || !incomingMember.linked_profile_id) {
        return jsonResponse(
          req,
          { error: "The incoming member needs a verified personal email and linked website account first" },
          409,
        );
      }
      const reason = typeof body?.reason === "string" && body.reason.trim()
        ? body.reason.trim().slice(0, 1000)
        : "Officer or functional role change";
      const now = new Date().toISOString();
      const { data: handover, error: handoverError } = await supabaseAdmin
        .from("officer_email_handovers")
        .insert({
          email_account_id: account.id,
          position_id: account.position_id,
          outgoing_member_id: account.current_authorized_member_id,
          incoming_member_id: incomingMember.id,
          initiated_by: user.id,
          confirmed_at: now,
          state: "REVOKING_ACCESS",
          reason,
        })
        .select("id")
        .single();
      if (handoverError) throw handoverError;

      if (account.current_authorized_member_id) {
        const { error } = await supabaseAdmin
          .from("officer_mailbox_assignments")
          .update({ status: "REVOKED", assignment_end: now, updated_at: now })
          .eq("email_account_id", account.id)
          .eq("member_id", account.current_authorized_member_id)
          .in("status", ["PENDING", "ACTIVE"]);
        if (error) throw error;
      }
      const { error: revokeWebsiteError } = await supabaseAdmin
        .from("lodge_email_accounts")
        .update({
          current_authorized_member_id: null,
          status: "PASSWORD_SETUP_PENDING",
          credential_status: "ROTATED",
          updated_at: now,
        })
        .eq("id", account.id);
      if (revokeWebsiteError) throw revokeWebsiteError;
      await supabaseAdmin
        .from("officer_email_handovers")
        .update({
          state: "ROTATING_CREDENTIALS",
          outgoing_access_revoked_at: now,
          updated_at: now,
        })
        .eq("id", handover.id);

      try {
        const invitation = await prepareRoleInvitation(
          supabaseAdmin,
          supabaseUrl,
          serviceRoleKey,
          user.id,
          { ...account, current_authorized_member_id: incomingMember.id },
          incomingMember,
          crypto.randomUUID(),
          handover.id,
        );
        await insertAudit(supabaseAdmin, {
          event_type: "OFFICER_HANDOVER_INITIATED",
          email_account_id: account.id,
          member_id: incomingMember.id,
          position_id: account.position_id,
          handover_id: handover.id,
          actor_profile_id: user.id,
          details: {
            outgoing_member_id: account.current_authorized_member_id,
            incoming_member_id: incomingMember.id,
            notification_id: invitation.id,
          },
        });
        return jsonResponse(req, { handoverId: handover.id, state: "WAITING_FOR_ACCEPTANCE" });
      } catch (error) {
        const failure = error instanceof Error ? error.message : "Unknown provider failure";
        await supabaseAdmin
          .from("officer_email_handovers")
          .update({
            state: "FAILED",
            failure_step: "ROTATING_CREDENTIALS_OR_INVITING_INCOMING_HOLDER",
            failure_message: failure,
            updated_at: new Date().toISOString(),
          })
          .eq("id", handover.id);
        await supabaseAdmin
          .from("lodge_email_accounts")
          .update({ status: "ERROR", credential_status: "ERROR" })
          .eq("id", account.id);
        await insertAudit(supabaseAdmin, {
          event_type: "OFFICER_HANDOVER_FAILED",
          email_account_id: account.id,
          member_id: incomingMember.id,
          position_id: account.position_id,
          handover_id: handover.id,
          actor_profile_id: user.id,
          outcome: "FAILURE",
          details: {
            failed_step: "ROTATING_CREDENTIALS_OR_INVITING_INCOMING_HOLDER",
            outgoing_website_access_revoked: true,
            provider_credentials_may_still_work: true,
          },
        });
        return jsonResponse(req, {
          error: "The handover needs administrator attention. Website access was revoked, but MXroute credential rotation or the incoming invitation failed.",
          handoverId: handover.id,
          state: "FAILED",
          providerCredentialsMayStillWork: true,
        }, 502);
      }
    }

    if (action === "admin_retry_handover") {
      const { data: handover, error } = await supabaseAdmin
        .from("officer_email_handovers")
        .select("id, incoming_member_id, retry_count, state")
        .eq("email_account_id", account.id)
        .eq("state", "FAILED")
        .order("initiated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!handover?.incoming_member_id) {
        return jsonResponse(req, { error: "No failed handover is available to retry" }, 409);
      }
      const incomingMember = await getMember(supabaseAdmin, handover.incoming_member_id);
      if (!incomingMember) return jsonResponse(req, { error: "Incoming member not found" }, 404);
      await supabaseAdmin
        .from("officer_email_handovers")
        .update({
          state: "ROTATING_CREDENTIALS",
          retry_count: handover.retry_count + 1,
          failure_step: null,
          failure_message: null,
        })
        .eq("id", handover.id);
      try {
        const notification = await prepareRoleInvitation(
          supabaseAdmin,
          supabaseUrl,
          serviceRoleKey,
          user.id,
          { ...account, current_authorized_member_id: incomingMember.id },
          incomingMember,
          crypto.randomUUID(),
          handover.id,
        );
        await insertAudit(supabaseAdmin, {
          event_type: "OFFICER_HANDOVER_RETRIED",
          email_account_id: account.id,
          member_id: incomingMember.id,
          position_id: account.position_id,
          handover_id: handover.id,
          actor_profile_id: user.id,
          details: { notification_id: notification.id, retry_count: handover.retry_count + 1 },
        });
        return jsonResponse(req, { handoverId: handover.id, state: "WAITING_FOR_ACCEPTANCE" });
      } catch (retryError) {
        const failure = retryError instanceof Error ? retryError.message : "Unknown retry failure";
        await supabaseAdmin
          .from("officer_email_handovers")
          .update({
            state: "FAILED",
            failure_step: "RETRY_ROTATION_OR_INVITATION",
            failure_message: failure,
          })
          .eq("id", handover.id);
        return jsonResponse(req, { error: "The handover retry failed", handoverId: handover.id }, 502);
      }
    }

    if (action === "admin_suspend_account") {
      if (body?.confirmed !== true) {
        return jsonResponse(req, { error: "Explicit confirmation is required" }, 400);
      }
      const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
      if (!reason) return jsonResponse(req, { error: "A suspension reason is required" }, 400);
      const provider = createMxrouteProvider();
      await provider.updateMailbox(account.address, { password: createProviderLockPassword() });
      const now = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from("lodge_email_accounts")
        .update({
          status: "SUSPENDED",
          credential_status: "ROTATED",
          suspended_at: now,
          last_credential_rotation_at: now,
          updated_at: now,
        })
        .eq("id", account.id);
      if (error) throw error;
      await insertAudit(supabaseAdmin, {
        event_type: "ROLE_MAILBOX_SUSPENDED",
        email_account_id: account.id,
        member_id: account.current_authorized_member_id,
        position_id: account.position_id,
        actor_profile_id: user.id,
        outcome: "WARNING",
        details: {
          reason,
          credentials_rotated: true,
          provider_native_suspend_supported: false,
          provider_session_revocation_supported: false,
        },
      });
      return jsonResponse(req, {
        suspended: true,
        providerNativeSuspendSupported: false,
        providerSessionRevocationSupported: false,
      });
    }

    if (action === "admin_reactivate_account") {
      if (!account.current_authorized_member_id) {
        return jsonResponse(req, { error: "Assign a current holder before reactivation" }, 409);
      }
      const member = await getMember(supabaseAdmin, account.current_authorized_member_id);
      if (!member) return jsonResponse(req, { error: "Assigned member not found" }, 404);
      const notification = await prepareRoleInvitation(
        supabaseAdmin,
        supabaseUrl,
        serviceRoleKey,
        user.id,
        account,
        member,
        crypto.randomUUID(),
        null,
      );
      await insertAudit(supabaseAdmin, {
        event_type: "ROLE_MAILBOX_REACTIVATION_REQUESTED",
        email_account_id: account.id,
        member_id: member.id,
        position_id: account.position_id,
        actor_profile_id: user.id,
        details: { notification_id: notification.id },
      });
      return jsonResponse(req, { queued: true, notificationId: notification.id });
    }

    if (action === "admin_vacate_role") {
      if (body?.confirmed !== true) {
        return jsonResponse(req, { error: "Explicit confirmation is required" }, 400);
      }
      const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
      if (!reason) return jsonResponse(req, { error: "An override reason is required" }, 400);
      const provider = createMxrouteProvider();
      await provider.updateMailbox(account.address, { password: createProviderLockPassword() });
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("officer_mailbox_assignments")
        .update({ status: "REVOKED", assignment_end: now, reason, updated_at: now })
        .eq("email_account_id", account.id)
        .in("status", ["PENDING", "ACTIVE"]);
      const { error } = await supabaseAdmin
        .from("lodge_email_accounts")
        .update({
          current_authorized_member_id: null,
          status: "DISABLED",
          credential_status: "ROTATED",
          disabled_at: now,
          last_credential_rotation_at: now,
          updated_at: now,
        })
        .eq("id", account.id);
      if (error) throw error;
      await insertAudit(supabaseAdmin, {
        event_type: "ROLE_MAILBOX_ADMIN_OVERRIDE_VACATED",
        email_account_id: account.id,
        member_id: account.current_authorized_member_id,
        position_id: account.position_id,
        actor_profile_id: user.id,
        outcome: "WARNING",
        details: { reason, credentials_rotated: true },
      });
      return jsonResponse(req, { vacated: true });
    }

    return jsonResponse(req, { error: "Unsupported action" }, 400);
  } catch (error) {
    console.error(
      "manage-lodge-email error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return jsonResponse(
      req,
      { error: error instanceof Error ? error.message : "The Lodge email request failed" },
      500,
    );
  }
});
