import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";
import {
  type BrandedEmail,
  renderBrandedEmail,
} from "../_shared/branded-email.ts";
import {
  contentLengthExceeds,
  handlePreflight,
  jsonResponse,
  rejectDisallowedOrigin,
} from "../_shared/http-security.ts";

type NotificationJob = {
  id: string;
  notification_type: string;
  recipient_email: string;
  payload: Record<string, unknown>;
  attempt_count: number;
  max_attempts: number;
  idempotency_key: string;
};

const payloadString = (payload: Record<string, unknown>, key: string) =>
  typeof payload[key] === "string" ? payload[key] as string : "";

const payloadStringArray = (payload: Record<string, unknown>, key: string) =>
  Array.isArray(payload[key])
    ? payload[key].filter((value): value is string => typeof value === "string")
    : [];

const payloadPlainText = (payload: Record<string, unknown>, key: string) =>
  payloadString(payload, key)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const createRawActionToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const isServiceRoleJwtForProject = (token: string, supabaseUrl: string) => {
  try {
    const [, encodedPayload] = token.split(".");
    if (!encodedPayload) return false;

    const normalizedPayload = encodedPayload
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
    const payload = JSON.parse(atob(normalizedPayload)) as {
      ref?: string;
      role?: string;
    };
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];

    return payload.role === "service_role" && payload.ref === projectRef;
  } catch {
    return false;
  }
};

const productionSiteUrl = (configuredValue: string | undefined) => {
  const configured = configuredValue?.replace(/\/$/, "");
  return configured === "https://www.carpmasons.ca" ||
      configured === "https://carpmasons.ca"
    ? configured
    : "https://www.carpmasons.ca";
};

const formatEventDate = (value: string) => {
  if (!value) return "";
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(parsed);
};

const renderEmail = (
  job: NotificationJob,
  siteUrl: string,
  secureActionUrl = "",
): BrandedEmail => {
  const title = payloadString(job.payload, "title") || "Lodge event";
  const eventDate = formatEventDate(payloadString(job.payload, "event_date"));
  const reviewNotes = payloadString(job.payload, "review_notes");
  const adminUrl = `${siteUrl.replace(/\/$/, "")}/admin/events`;
  const calendarUrl = `${siteUrl.replace(/\/$/, "")}/calendar`;

  if (job.notification_type === "event_approval_requested") {
    const submittedBy = payloadString(job.payload, "submitted_by");
    return renderBrandedEmail({
      subject: `Event approval requested: ${title}`,
      preheader: `${title} is awaiting calendar approval.`,
      eyebrow: "Calendar approval",
      heading: "An event is awaiting review",
      paragraphs: [
        "A lodge member submitted an event for the lodge calendar. Please review the details and approve or decline the submission.",
      ],
      details: [
        { label: "Event", value: title },
        ...(eventDate ? [{ label: "Date", value: eventDate }] : []),
        ...(submittedBy ? [{ label: "Submitted by", value: submittedBy }] : []),
        { label: "Status", value: "Pending approval" },
      ],
      cta: { label: "Review event submission", url: adminUrl },
      siteUrl,
    });
  }

  if (job.notification_type === "event_submission_approved") {
    return renderBrandedEmail({
      subject: `Your event was approved: ${title}`,
      preheader: `${title} is now published on the lodge calendar.`,
      eyebrow: "Calendar update",
      heading: "Your event was approved",
      paragraphs: [
        "Your event submission has been approved and is now published on the lodge calendar.",
      ],
      details: [
        { label: "Event", value: title },
        ...(eventDate ? [{ label: "Date", value: eventDate }] : []),
        { label: "Status", value: "Approved" },
        ...(reviewNotes
          ? [{ label: "Reviewer note", value: reviewNotes }]
          : []),
      ],
      cta: { label: "View the lodge calendar", url: calendarUrl },
      siteUrl,
    });
  }

  if (job.notification_type === "event_submission_rejected") {
    return renderBrandedEmail({
      subject: `Update on your event submission: ${title}`,
      preheader: `There is an update on your submission for ${title}.`,
      eyebrow: "Calendar update",
      heading: "Your submission needs revision",
      paragraphs: [
        "Your event submission was not approved for the lodge calendar. You may revise the details and submit a new request from the lodge website.",
      ],
      details: [
        { label: "Event", value: title },
        ...(eventDate ? [{ label: "Date", value: eventDate }] : []),
        { label: "Status", value: "Not approved" },
        ...(reviewNotes
          ? [{ label: "Reviewer note", value: reviewNotes }]
          : []),
      ],
      cta: { label: "Return to the lodge calendar", url: calendarUrl },
      siteUrl,
    });
  }

  if (job.notification_type === "new_summons") {
    const month = payloadString(job.payload, "month");
    const excerpt = payloadString(job.payload, "excerpt");
    const summonsUrl = `${siteUrl.replace(/\/$/, "")}/summons`;

    return renderBrandedEmail({
      subject: `New summons: ${title}`,
      preheader: month
        ? `The ${month} summons is now available.`
        : "A new Lodge summons is now available.",
      eyebrow: "Lodge summons",
      heading: title,
      paragraphs: [
        month
          ? `The Carleton Lodge summons for ${month} has been posted.`
          : "A new Carleton Lodge summons has been posted.",
        ...(excerpt ? [excerpt] : []),
      ],
      details: month ? [{ label: "Issue", value: month }] : [],
      cta: { label: "Read the summons", url: summonsUrl },
      siteUrl,
    });
  }

  if (["new_event", "event_updated"].includes(job.notification_type)) {
    const eventTime = payloadString(job.payload, "event_time").slice(0, 5);
    const location = payloadString(job.payload, "location");
    const eventStatus = payloadString(job.payload, "event_status") ||
      "scheduled";
    const statusNote = payloadString(job.payload, "status_note");
    const isNew = job.notification_type === "new_event";
    const heading = eventStatus === "cancelled"
      ? `Cancelled: ${title}`
      : eventStatus === "postponed"
      ? `Postponed: ${title}`
      : isNew
      ? `New lodge event: ${title}`
      : `Event updated: ${title}`;

    return renderBrandedEmail({
      subject: heading,
      preheader: statusNote || `${title} is ${eventStatus}.`,
      eyebrow: "Lodge calendar",
      heading,
      paragraphs: [
        statusNote ||
        (isNew
          ? "A new event has been added to the Carleton Lodge calendar."
          : "Details for this lodge event have changed. Please review the latest information on the website."),
      ],
      details: [
        { label: "Event", value: title },
        ...(eventDate ? [{ label: "Date", value: eventDate }] : []),
        ...(eventTime ? [{ label: "Time", value: eventTime }] : []),
        ...(location ? [{ label: "Location", value: location }] : []),
        { label: "Status", value: eventStatus },
      ],
      cta: { label: "View current event details", url: calendarUrl },
      siteUrl,
    });
  }

  if (job.notification_type === "new_announcement") {
    const priority = payloadString(job.payload, "priority") || "normal";
    const body = payloadPlainText(job.payload, "body").slice(0, 1200);
    const myLodgeUrl = `${siteUrl.replace(/\/$/, "")}/my-lodge`;

    return renderBrandedEmail({
      subject: `${
        priority === "urgent" ? "Urgent lodge notice" : "Lodge announcement"
      }: ${title}`,
      preheader: body.slice(0, 180) || "A new lodge announcement is available.",
      eyebrow: priority === "normal"
        ? "Lodge announcement"
        : `${priority} notice`,
      heading: title,
      paragraphs: body ? [body] : ["A new lodge announcement has been posted."],
      details: [{ label: "Priority", value: priority }],
      cta: { label: "View announcements on My Lodge", url: myLodgeUrl },
      siteUrl,
    });
  }

  if (job.notification_type === "standard_template_preview") {
    return renderBrandedEmail({
      subject: "Carleton Lodge email template preview",
      preheader: "The lodge email system and standard template are ready.",
      eyebrow: "Email system test",
      heading: "The lodge email template is ready",
      paragraphs: [
        "This message confirms that the Carleton Lodge email service is working and that the new standard template is active.",
        "Future calendar approvals, member notifications, summons notices, and other transactional messages can all use this same professional, responsive design.",
      ],
      details: [
        { label: "Sender", value: "notifications@carpmasons.ca" },
        { label: "Website", value: "carpmasons.ca" },
        { label: "Delivery", value: "Resend" },
      ],
      cta: { label: "Visit carpmasons.ca", url: siteUrl.replace(/\/$/, "") },
      siteUrl,
    });
  }

  if (job.notification_type === "member_account_invitation") {
    if (!secureActionUrl) {
      throw new Error("The secure account setup URL was not generated");
    }

    const memberName = payloadString(job.payload, "member_name") ||
      "Brother";
    const lodgeEmail = payloadString(job.payload, "lodge_email");
    const mailboxStatus = payloadString(job.payload, "mailbox_status");
    const mailboxAlreadyActive = mailboxStatus === "active";
    const permissionSummary = payloadStringArray(job.payload, "permissions");
    const baseAccess = [
      "Lodge calendar and event submissions",
      "Summons and lodge notices",
      "Members directory",
      "Document library",
      "Member photo gallery",
    ].join("\n");

    return renderBrandedEmail({
      subject: "Welcome to the Carleton Lodge members' website",
      preheader:
        "Your lodge website account and carpmasons.ca email are ready for setup.",
      eyebrow: "Member welcome",
      heading: `Welcome, ${memberName}`,
      paragraphs: [
        "Your account for the Carleton Lodge members' website is ready, and a personal lodge email address has been reserved for you.",
        mailboxAlreadyActive
          ? "Use the secure button below to choose your website password. Your lodge mailbox is already active and will be available from your member profile after you sign in. For your protection, this link is temporary and can only be used once."
          : "Use the secure button below to choose your website password. The website will then guide you through one short final step to activate your lodge mailbox. For your protection, this link is temporary and can only be used once.",
      ],
      details: [
        { label: "Website sign-in email", value: job.recipient_email },
        ...(lodgeEmail
          ? [{ label: "Your lodge email", value: lodgeEmail }]
          : []),
        ...(mailboxAlreadyActive
          ? [{ label: "Lodge mailbox", value: "Already active" }]
          : [{
            label: "Lodge mailbox",
            value: "Ready to activate during setup",
          }]),
        { label: "Member access", value: baseAccess },
        ...(permissionSummary.length
          ? [{
            label: "Administrative access",
            value: permissionSummary.join("\n"),
          }]
          : []),
      ],
      cta: { label: "Start my account setup", url: secureActionUrl },
      siteUrl,
    });
  }

  if (job.notification_type === "role_mailbox_invitation") {
    if (!secureActionUrl) {
      throw new Error(
        "The secure role-mailbox activation URL was not generated",
      );
    }
    const memberName = payloadString(job.payload, "member_name") || "Brother";
    const lodgeEmail = payloadString(job.payload, "lodge_email");
    const displayName = payloadString(job.payload, "display_name") ||
      "Lodge role";
    return renderBrandedEmail({
      subject: `Activate the ${displayName} Lodge mailbox`,
      preheader:
        `Your temporary access to ${lodgeEmail} is ready for secure setup.`,
      eyebrow: "Officer account",
      heading: `Your ${displayName} mailbox is ready`,
      paragraphs: [
        `${memberName}, Carleton Lodge No. 465 has assigned you temporary access to its ${displayName} mailbox.`,
        "This mailbox belongs permanently to the Lodge and retains its existing messages, folders, attachments, and correspondence when office holders change.",
        "Use the secure button below to review the Officer and Functional Email Account Agreement and choose a new mailbox password. The link is time-limited and can only be used once.",
      ],
      details: [
        { label: "Lodge role", value: displayName },
        { label: "Lodge mailbox", value: lodgeEmail },
        { label: "Ownership", value: "Carleton Lodge No. 465" },
        { label: "Access", value: "Temporary while assigned to this role" },
      ],
      cta: { label: "Activate the role mailbox", url: secureActionUrl },
      siteUrl,
    });
  }

  if (job.notification_type === "email_account_password_reset") {
    if (!secureActionUrl) {
      throw new Error(
        "The secure mailbox password-reset URL was not generated",
      );
    }
    const lodgeEmail = payloadString(job.payload, "lodge_email");
    const displayName = payloadString(job.payload, "display_name") ||
      "Lodge email";
    return renderBrandedEmail({
      subject: `Reset the password for ${lodgeEmail}`,
      preheader: "A secure Lodge mailbox password reset was requested.",
      eyebrow: "Mailbox security",
      heading: "Choose a new mailbox password",
      paragraphs: [
        `A password reset was requested for the ${displayName} mailbox shown below.`,
        "Use the secure button to choose a new password. The link is time-limited, can only be used once, and does not contain or reveal your password.",
        "If you did not request this reset, do not use the link and contact Lodge Support.",
      ],
      details: [{ label: "Lodge mailbox", value: lodgeEmail }],
      cta: { label: "Reset mailbox password", url: secureActionUrl },
      siteUrl,
    });
  }

  if (job.notification_type === "email_account_activation_confirmation") {
    const lodgeEmail = payloadString(job.payload, "lodge_email");
    const displayName = payloadString(job.payload, "display_name") ||
      "Lodge email";
    const mailboxUrl = `${siteUrl.replace(/\/$/, "")}/my-lodge/email`;
    return renderBrandedEmail({
      subject: `${displayName} mailbox activated`,
      preheader: `${lodgeEmail} is ready to use.`,
      eyebrow: "Mailbox ready",
      heading: "Your Lodge mailbox is active",
      paragraphs: [
        "Your agreement and new mailbox credentials have been recorded successfully.",
        "You can open Webmail or connect the account to your phone or computer from the Lodge website.",
      ],
      details: [{ label: "Lodge mailbox", value: lodgeEmail }],
      cta: { label: "View my Lodge email", url: mailboxUrl },
      siteUrl,
    });
  }

  throw new Error(`Unsupported notification type: ${job.notification_type}`);
};

const sendWithResend = async (
  job: NotificationJob,
  email: BrandedEmail,
  apiKey: string,
  fromAddress: string,
) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": job.idempotency_key,
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [job.recipient_email],
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof result?.message === "string"
        ? result.message
        : `Resend returned HTTP ${response.status}`,
    );
  }

  return String(result.id);
};

const sendWithAgentMail = async (
  job: NotificationJob,
  email: BrandedEmail,
  apiKey: string,
  inboxId: string,
) => {
  const response = await fetch(
    `https://api.agentmail.to/v0/inboxes/${
      encodeURIComponent(inboxId)
    }/messages/send`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": job.idempotency_key,
      },
      body: JSON.stringify({
        to: [job.recipient_email],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
    },
  );

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof result?.message === "string"
        ? result.message
        : `AgentMail returned HTTP ${response.status}`,
    );
  }

  return String(result.message_id);
};

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
  const provider = (Deno.env.get("EMAIL_PROVIDER") ?? "resend").toLowerCase();
  const apiKey = Deno.env.get("EMAIL_API_KEY");
  const fromAddress = Deno.env.get("EMAIL_FROM");
  const inboxId = Deno.env.get("EMAIL_INBOX_ID");
  // Welcome and recovery links must never inherit a development/localhost URL
  // from a stale secret. Only the two production origins are accepted.
  const siteUrl = productionSiteUrl(Deno.env.get("SITE_URL"));

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(req, {
      error: "Supabase function environment is incomplete",
    }, 500);
  }
  if (!apiKey) {
    return jsonResponse(req, { error: "Email service unavailable" }, 503);
  }
  if (provider === "resend" && !fromAddress) {
    return jsonResponse(req, { error: "Email service unavailable" }, 503);
  }
  if (provider === "agentmail" && !inboxId) {
    return jsonResponse(
      req,
      { error: "Email service unavailable" },
      503,
    );
  }
  if (!["resend", "agentmail"].includes(provider)) {
    return jsonResponse(
      req,
      { error: "Email service unavailable" },
      503,
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  // Supabase projects can expose a modern sb_secret key to Edge Functions while
  // scheduled jobs still authenticate with the project's verified legacy
  // service_role JWT. The gateway verifies that JWT before this handler runs;
  // also bind its project ref so a token from another project is rejected.
  let authorized = token === serviceRoleKey ||
    isServiceRoleJwtForProject(token, supabaseUrl);

  if (!authorized && token) {
    const { data: userResult } = await supabase.auth.getUser(token);
    if (userResult.user) {
      const [{ data: profile }, { data: permission }] = await Promise.all([
        supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", userResult.user.id)
          .maybeSingle(),
        supabase
          .from("admin_section_permissions")
          .select("can_write")
          .eq("profile_id", userResult.user.id)
          .eq("section", "communications")
          .eq("can_write", true)
          .maybeSingle(),
      ]);
      authorized = profile?.is_admin === true || permission?.can_write === true;
    }
  }

  if (!authorized) {
    return jsonResponse(req, { error: "Not authorized" }, 403);
  }

  const requestBody = await req.json().catch(() => ({})) as {
    batchSize?: number;
  };
  const requestedBatchSize = Number.isFinite(requestBody.batchSize)
    ? Math.trunc(requestBody.batchSize as number)
    : 25;
  const batchSize = Math.min(Math.max(requestedBatchSize, 1), 100);

  const { data, error: claimError } = await supabase.rpc(
    "claim_notification_outbox",
    { batch_size: batchSize },
  );

  if (claimError) {
    console.error("Could not claim notification outbox:", claimError);
    return jsonResponse(req, { error: "Could not process notifications" }, 500);
  }

  const jobs = (data ?? []) as NotificationJob[];
  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      let secureActionUrl = "";
      if (job.notification_type === "member_account_invitation") {
        const { data: linkData, error: linkError } = await supabase.auth.admin
          .generateLink({
            type: "recovery",
            email: job.recipient_email,
            options: {
              redirectTo: `${siteUrl.replace(/\/$/, "")}/reset-password`,
            },
          });

        if (linkError) throw linkError;
        secureActionUrl = linkData.properties?.action_link ?? "";
        if (!secureActionUrl) {
          throw new Error("Supabase Auth did not return an account setup link");
        }
      } else if (
        ["role_mailbox_invitation", "email_account_password_reset"].includes(
          job.notification_type,
        )
      ) {
        const accountId = payloadString(job.payload, "email_account_id");
        const memberId = payloadString(job.payload, "member_id");
        const handoverId = payloadString(job.payload, "handover_id") || null;
        const purpose = job.notification_type === "role_mailbox_invitation"
          ? "ROLE_ACTIVATION"
          : "PASSWORD_RESET";
        if (!accountId || !memberId) {
          throw new Error(
            "The mailbox action notification is missing its account or member",
          );
        }

        const rawActionToken = createRawActionToken();
        const tokenHash = await sha256(rawActionToken);
        const expiresInHours = purpose === "ROLE_ACTIVATION" ? 72 : 2;
        const now = new Date().toISOString();
        const { error: revokeError } = await supabase
          .from("email_account_action_tokens")
          .update({ revoked_at: now })
          .eq("email_account_id", accountId)
          .eq("member_id", memberId)
          .eq("purpose", purpose)
          .is("consumed_at", null)
          .is("revoked_at", null);
        if (revokeError) throw revokeError;

        const { error: tokenInsertError } = await supabase
          .from("email_account_action_tokens")
          .insert({
            token_hash: tokenHash,
            purpose,
            email_account_id: accountId,
            member_id: memberId,
            handover_id: handoverId,
            expires_at: new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
              .toISOString(),
          });
        if (tokenInsertError) throw tokenInsertError;

        secureActionUrl = `${
          siteUrl.replace(/\/$/, "")
        }/my-lodge/email?account=${encodeURIComponent(accountId)}#token=${
          encodeURIComponent(rawActionToken)
        }&purpose=${encodeURIComponent(purpose)}`;
      }

      const rendered = renderEmail(job, siteUrl, secureActionUrl);
      const providerMessageId = provider === "resend"
        ? await sendWithResend(job, rendered, apiKey, fromAddress!)
        : await sendWithAgentMail(job, rendered, apiKey, inboxId!);

      const { error: updateError } = await supabase
        .from("notification_outbox")
        .update({
          status: "sent",
          provider,
          provider_message_id: providerMessageId,
          sent_at: new Date().toISOString(),
          locked_at: null,
          last_error: null,
        })
        .eq("id", job.id);

      if (updateError) throw updateError;
      sent += 1;
    } catch (error) {
      const isTerminal = job.attempt_count >= job.max_attempts;
      const retrySeconds = Math.min(
        3600,
        60 * (2 ** Math.max(job.attempt_count - 1, 0)),
      );
      const { error: updateError } = await supabase
        .from("notification_outbox")
        .update({
          status: isTerminal ? "failed" : "queued",
          provider,
          available_at: new Date(Date.now() + retrySeconds * 1000)
            .toISOString(),
          locked_at: null,
          last_error: error instanceof Error ? error.message : String(error),
        })
        .eq("id", job.id);

      if (updateError) {
        console.error(
          "Could not record notification failure:",
          updateError.message,
        );
      }
      failed += 1;
    }
  }

  return jsonResponse(req, { claimed: jobs.length, sent, failed });
});
