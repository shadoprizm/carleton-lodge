import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import {
  contentLengthExceeds,
  handlePreflight,
  jsonResponse,
  rejectDisallowedOrigin,
} from "../_shared/http-security.ts";
import {
  createMxrouteProvider,
  LODGE_EMAIL_SETUP,
  mailboxProviderStatusJson,
} from "../_shared/lodge-email-provider.ts";
import { consumeRateLimit } from "../_shared/rate-limit.ts";

const minMailboxPasswordLength = 8;

type ActivationBody = {
  accountId?: unknown;
  password?: unknown;
  agreementAccepted?: unknown;
  policyVersionId?: unknown;
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handlePreflight(req);
  const originError = rejectDisallowedOrigin(req);
  if (originError) return originError;
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }
  if (contentLengthExceeds(req, 4096)) {
    return jsonResponse(req, { error: "Request body is too large" }, 413);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse(req, { error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse(req, { error: "Server configuration is incomplete" }, 500);
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      db: { schema: "carletonlodge" },
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: "carletonlodge" },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const actorLimit = await consumeRateLimit(
      supabaseAdmin,
      "mailbox-activation:user",
      user.id,
      10,
      60 * 60,
    );
    if (!actorLimit.allowed) {
      return jsonResponse(
        req,
        { error: "Too many activation attempts. Please wait and try again." },
        429,
      );
    }

    const body = await req.json().catch(() => null) as ActivationBody | null;
    const accountId = typeof body?.accountId === "string" ? body.accountId : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const policyVersionId = typeof body?.policyVersionId === "string"
      ? body.policyVersionId
      : "";

    const { data: member, error: memberError } = await supabaseAdmin
      .from("lodge_members")
      .select("id, lodge_email, mailbox_status")
      .eq("linked_profile_id", user.id)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!member) {
      return jsonResponse(req, { error: "No lodge member profile is linked to this account" }, 404);
    }

    let accountQuery = supabaseAdmin
      .from("lodge_email_accounts")
      .select("id, address, account_type, status, credential_status, agreement_required, activated_at")
      .eq("associated_member_id", member.id)
      .eq("account_type", "MEMBER");
    if (accountId) accountQuery = accountQuery.eq("id", accountId);
    const { data: account, error: accountError } = await accountQuery.maybeSingle();

    if (accountError) throw accountError;
    if (!account) {
      return jsonResponse(req, { error: "Your personal Lodge mailbox is not available" }, 404);
    }
    if (account.status === "SUSPENDED" || member.mailbox_status === "suspended") {
      return jsonResponse(req, { error: "This mailbox is suspended. Please contact Lodge Support." }, 409);
    }
    if (["NOT_PROVISIONED", "PROVISIONING", "ERROR", "DISABLED"].includes(account.status)) {
      return jsonResponse(req, { error: "Your mailbox is not ready for activation yet" }, 409);
    }

    const { data: policy, error: policyError } = await supabaseAdmin
      .from("email_policy_versions")
      .select("id, version, requires_reacceptance")
      .eq("policy_type", "MEMBER_EMAIL_TERMS")
      .eq("is_active", true)
      .lte("effective_at", new Date().toISOString())
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (policyError) throw policyError;
    if (!policy) {
      return jsonResponse(req, { error: "The member email agreement is not currently available" }, 503);
    }

    const { data: currentAcceptance, error: acceptanceError } = await supabaseAdmin
      .from("email_agreement_acceptances")
      .select("id, accepted_at")
      .eq("member_id", member.id)
      .eq("email_account_id", account.id)
      .eq("policy_version_id", policy.id)
      .maybeSingle();
    if (acceptanceError) throw acceptanceError;
    let acceptance = currentAcceptance;
    if (!acceptance && policy.requires_reacceptance === false) {
      const { data: priorAcceptance, error: priorAcceptanceError } = await supabaseAdmin
        .from("email_agreement_acceptances")
        .select("id, accepted_at")
        .eq("member_id", member.id)
        .eq("email_account_id", account.id)
        .order("accepted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (priorAcceptanceError) throw priorAcceptanceError;
      acceptance = priorAcceptance;
    }

    const needsAgreement = account.agreement_required && !acceptance;
    if (needsAgreement && (body?.agreementAccepted !== true || policyVersionId !== policy.id)) {
      return jsonResponse(
        req,
        { error: "You must read and accept the current Member Email Account Agreement before activation." },
        400,
      );
    }

    const needsPasswordSetup = account.credential_status !== "USER_SET";
    if (needsPasswordSetup) {
      const passwordError = validatePassword(password);
      if (passwordError) return jsonResponse(req, { error: passwordError }, 400);

      const mxroute = createMxrouteProvider();
      const providerAccount = await mxroute.getMailbox(account.address);
      if (!providerAccount) {
        return jsonResponse(req, { error: "The MXroute mailbox does not exist yet" }, 409);
      }
      await mxroute.updateMailbox(account.address, { password });
    }

    const now = new Date().toISOString();
    if (needsAgreement) {
      const { error: acceptanceInsertError } = await supabaseAdmin
        .from("email_agreement_acceptances")
        .insert({
          member_id: member.id,
          email_account_id: account.id,
          position_id: null,
          policy_version_id: policy.id,
          acknowledgement_state: true,
          accepted_by_profile_id: user.id,
          audit_metadata: { source: "member_portal" },
        });
      if (acceptanceInsertError) throw acceptanceInsertError;
    }

    const mxroute = createMxrouteProvider();
    const latestProviderStatus = await mxroute.getMailbox(account.address);
    const { error: governedUpdateError } = await supabaseAdmin
      .from("lodge_email_accounts")
      .update({
        status: "ACTIVE",
        credential_status: "USER_SET",
        activated_at: account.activated_at ?? now,
        last_credential_rotation_at: needsPasswordSetup ? now : undefined,
        provider_status: latestProviderStatus
          ? mailboxProviderStatusJson(latestProviderStatus)
          : {},
      })
      .eq("id", account.id);
    if (governedUpdateError) throw governedUpdateError;

    const { error: memberUpdateError } = await supabaseAdmin
      .from("lodge_members")
      .update({
        mailbox_status: "active",
        mailbox_activated_at: account.activated_at ?? now,
        updated_at: now,
      })
      .eq("id", member.id);
    if (memberUpdateError) throw memberUpdateError;

    const auditEvents = [];
    if (needsAgreement) {
      auditEvents.push({
        event_type: "MEMBER_AGREEMENT_ACCEPTED",
        email_account_id: account.id,
        member_id: member.id,
        actor_profile_id: user.id,
        outcome: "SUCCESS",
        details: { policy_version_id: policy.id, policy_version: policy.version },
      });
    }
    if (needsPasswordSetup) {
      auditEvents.push({
        event_type: "MAILBOX_PASSWORD_ESTABLISHED",
        email_account_id: account.id,
        member_id: member.id,
        actor_profile_id: user.id,
        outcome: "SUCCESS",
        details: { provider: "mxroute" },
      });
    }
    auditEvents.push({
      event_type: "MEMBER_MAILBOX_ACTIVATED",
      email_account_id: account.id,
      member_id: member.id,
      actor_profile_id: user.id,
      outcome: "SUCCESS",
      details: { existing_mailbox_preserved: !needsPasswordSetup },
    });
    const { error: auditError } = await supabaseAdmin
      .from("lodge_email_audit_events")
      .insert(auditEvents);
    if (auditError) throw auditError;

    return jsonResponse(req, {
      activated: true,
      accountId: account.id,
      lodgeEmail: account.address,
      webmailUrl: LODGE_EMAIL_SETUP.webmailUrl,
      agreementAcceptedAt: acceptance?.accepted_at ?? now,
    });
  } catch (error) {
    console.error(
      "activate-member-mailbox error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return jsonResponse(
      req,
      { error: "We could not activate the mailbox. Please try again or contact Lodge Support." },
      500,
    );
  }
});
