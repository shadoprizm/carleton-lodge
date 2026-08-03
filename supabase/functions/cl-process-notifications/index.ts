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
        "Your lodge member account is ready. Choose your password to get started.",
      eyebrow: "Member account",
      heading: `Welcome, ${memberName}`,
      paragraphs: [
        "Your account for the Carleton Lodge members' website is ready.",
        "Use the secure button below to choose your password and sign in. For your protection, the link is temporary and can only be used once. If it has expired, ask a lodge administrator to send a new account email.",
      ],
      details: [
        { label: "Login email", value: job.recipient_email },
        { label: "Member access", value: baseAccess },
        ...(permissionSummary.length
          ? [{
            label: "Administrative access",
            value: permissionSummary.join("\n"),
          }]
          : []),
      ],
      cta: { label: "Choose my password and sign in", url: secureActionUrl },
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
  const siteUrl = Deno.env.get("SITE_URL") ?? "https://www.carpmasons.ca";

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
    db: { schema: "carletonlodge" },
  });

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  let authorized = token === serviceRoleKey;

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
              redirectTo: siteUrl.replace(/\/$/, ""),
            },
          });

        if (linkError) throw linkError;
        secureActionUrl = linkData.properties?.action_link ?? "";
        if (!secureActionUrl) {
          throw new Error("Supabase Auth did not return an account setup link");
        }
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
