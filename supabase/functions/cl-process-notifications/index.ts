import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.110.8";
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
import {
  ACCOUNT_SETUP_REDIRECT_URL,
  validateAccountSetupActionLink,
} from "../_shared/auth-action-link.ts";
import { renderExternalLinkAlertEmail } from "../_shared/external-link-alert-email.ts";
import {
  nextRoleMailboxActivationWindow,
  normalizeRoleMailboxActivationWindow,
  ROLE_MAILBOX_ACTIVATION_MAX_WINDOWS,
  ROLE_MAILBOX_ACTIVATION_WINDOW_HOURS,
  type RoleMailboxActivationWindow,
  roleMailboxReminderIdempotencyKey,
  shouldQueueRoleMailboxActivationReminder,
} from "../_shared/role-mailbox-activation.ts";

type NotificationJob = {
  id: string;
  notification_type: string;
  recipient_email: string;
  payload: Record<string, unknown>;
  attempt_count: number;
  max_attempts: number;
  idempotency_key: string;
};

// The project has no generated Edge Function database type yet; keep the
// schema-aware client usable until Supabase types are generated.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LodgeSupabaseClient = SupabaseClient<any, any, any, any, any>;

type DueRoleActivationToken = {
  id: string;
  email_account_id: string;
  member_id: string;
  handover_id: string | null;
  activation_window: number;
  expires_at: string;
};

type ReminderRoleAccount = {
  id: string;
  address: string;
  account_type: "OFFICER" | "FUNCTIONAL";
  status: string;
  position_id: string | null;
  current_authorized_member_id: string | null;
  display_name: string;
};

type ReminderMember = {
  id: string;
  full_name: string;
  email: string | null;
  linked_profile_id: string | null;
};

type PendingRoleInvitation = {
  payload: Record<string, unknown>;
};

const payloadString = (payload: Record<string, unknown>, key: string) =>
  typeof payload[key] === "string" ? payload[key] as string : "";

const payloadStringArray = (payload: Record<string, unknown>, key: string) =>
  Array.isArray(payload[key])
    ? payload[key].filter((value): value is string => typeof value === "string")
    : [];

const payloadBoolean = (payload: Record<string, unknown>, key: string) =>
  payload[key] === true;

const activationWindowFromPayload = (payload: Record<string, unknown>) =>
  normalizeRoleMailboxActivationWindow(payload.activation_window);

const assignmentKey = (accountId: string, memberId: string) =>
  `${accountId}:${memberId}`;

async function roleMailboxActivationIsStillPending(
  supabase: LodgeSupabaseClient,
  accountId: string,
  memberId: string,
) {
  const [{ data: account, error: accountError }, {
    data: assignment,
    error: assignmentError,
  }] = await Promise.all([
    supabase
      .from("lodge_email_accounts")
      .select("id")
      .eq("id", accountId)
      .in("account_type", ["OFFICER", "FUNCTIONAL"])
      .eq("status", "INVITATION_PENDING")
      .eq("current_authorized_member_id", memberId)
      .maybeSingle(),
    supabase
      .from("officer_mailbox_assignments")
      .select("id")
      .eq("email_account_id", accountId)
      .eq("member_id", memberId)
      .eq("status", "PENDING")
      .maybeSingle(),
  ]);
  if (accountError) throw accountError;
  if (assignmentError) throw assignmentError;
  return Boolean(account && assignment);
}

async function queueDueRoleMailboxActivationReminders(
  supabase: LodgeSupabaseClient,
  now: string,
) {
  const { data, error } = await supabase
    .from("email_account_action_tokens")
    .select(
      "id, email_account_id, member_id, handover_id, activation_window, expires_at",
    )
    .eq("purpose", "ROLE_ACTIVATION")
    .is("consumed_at", null)
    .is("revoked_at", null)
    .lt("activation_window", ROLE_MAILBOX_ACTIVATION_MAX_WINDOWS)
    .lte("expires_at", now)
    .order("expires_at", { ascending: true })
    .limit(100);
  if (error) throw error;

  const candidates = ((data ?? []) as DueRoleActivationToken[])
    .map((token) => ({
      token,
      nextWindow: nextRoleMailboxActivationWindow(token.activation_window),
    }))
    .filter((candidate): candidate is {
      token: DueRoleActivationToken;
      nextWindow: RoleMailboxActivationWindow;
    } => candidate.nextWindow !== null);
  if (candidates.length === 0) return 0;

  const accountIds = [
    ...new Set(candidates.map(({ token }) => token.email_account_id)),
  ];
  const memberIds = [
    ...new Set(candidates.map(({ token }) => token.member_id)),
  ];
  const [
    { data: accounts, error: accountsError },
    {
      data: members,
      error: membersError,
    },
    { data: assignments, error: assignmentsError },
    {
      data: pendingInvitations,
      error: pendingInvitationsError,
    },
  ] = await Promise.all([
    supabase
      .from("lodge_email_accounts")
      .select(
        "id, address, account_type, status, position_id, current_authorized_member_id, display_name",
      )
      .in("id", accountIds)
      .in("account_type", ["OFFICER", "FUNCTIONAL"]),
    supabase
      .from("lodge_members")
      .select("id, full_name, email, linked_profile_id")
      .in("id", memberIds),
    supabase
      .from("officer_mailbox_assignments")
      .select("email_account_id, member_id")
      .in("email_account_id", accountIds)
      .in("member_id", memberIds)
      .eq("status", "PENDING"),
    supabase
      .from("notification_outbox")
      .select("payload")
      .eq("notification_type", "role_mailbox_invitation")
      .in("status", ["queued", "processing"])
      .limit(500),
  ]);
  if (accountsError) throw accountsError;
  if (membersError) throw membersError;
  if (assignmentsError) throw assignmentsError;
  if (pendingInvitationsError) throw pendingInvitationsError;

  const accountsById = new Map(
    ((accounts ?? []) as ReminderRoleAccount[]).map((account) => [
      account.id,
      account,
    ]),
  );
  const membersById = new Map(
    ((members ?? []) as ReminderMember[]).map((member) => [member.id, member]),
  );
  const pendingAssignments = new Set(
    (assignments ?? []).map((assignment) =>
      assignmentKey(assignment.email_account_id, assignment.member_id)
    ),
  );
  const pendingInvitationKeys = new Set(
    ((pendingInvitations ?? []) as PendingRoleInvitation[]).flatMap((job) => {
      const accountId = payloadString(job.payload, "email_account_id");
      const memberId = payloadString(job.payload, "member_id");
      return accountId && memberId ? [assignmentKey(accountId, memberId)] : [];
    }),
  );

  const reminderJobs = candidates.flatMap(({ token, nextWindow }) => {
    const account = accountsById.get(token.email_account_id);
    const member = membersById.get(token.member_id);
    if (!account || !member || !member.email || !member.linked_profile_id) {
      return [];
    }
    const hasPendingAssignment = pendingAssignments.has(
      assignmentKey(account.id, member.id),
    );
    const hasPendingInvitation = pendingInvitationKeys.has(
      assignmentKey(account.id, member.id),
    );
    if (
      hasPendingInvitation ||
      !shouldQueueRoleMailboxActivationReminder({
        accountType: account.account_type,
        accountStatus: account.status,
        currentAuthorizedMemberId: account.current_authorized_member_id,
        memberId: member.id,
        memberEmail: member.email,
        linkedProfileId: member.linked_profile_id,
        hasPendingAssignment,
      })
    ) return [];

    return [{
      notification_type: "role_mailbox_invitation",
      recipient_profile_id: member.linked_profile_id,
      recipient_email: member.email.toLowerCase(),
      payload: {
        email_account_id: account.id,
        lodge_email: account.address,
        account_type: account.account_type,
        display_name: account.display_name,
        position_id: account.position_id,
        member_id: member.id,
        member_name: member.full_name,
        handover_id: token.handover_id,
        token_purpose: "ROLE_ACTIVATION",
        activation_window: nextWindow,
        activation_reminder: true,
        previous_token_id: token.id,
      },
      idempotency_key: roleMailboxReminderIdempotencyKey(token.id, nextWindow),
      max_attempts: 3,
    }];
  });
  if (reminderJobs.length === 0) return 0;

  const { data: insertedJobs, error: reminderError } = await supabase
    .from("notification_outbox")
    .upsert(reminderJobs, {
      onConflict: "idempotency_key",
      ignoreDuplicates: true,
    })
    .select("id, idempotency_key");
  if (reminderError) throw reminderError;

  const insertedKeys = new Set(
    (insertedJobs ?? []).map((job) => job.idempotency_key),
  );
  const auditEvents = candidates.flatMap(({ token, nextWindow }) => {
    const key = roleMailboxReminderIdempotencyKey(token.id, nextWindow);
    if (!insertedKeys.has(key)) return [];
    const account = accountsById.get(token.email_account_id);
    return [{
      event_type: "ROLE_MAILBOX_ACTIVATION_REMINDER_QUEUED",
      email_account_id: token.email_account_id,
      member_id: token.member_id,
      position_id: account?.position_id ?? null,
      handover_id: token.handover_id,
      outcome: "SUCCESS",
      details: {
        activation_window: nextWindow,
        expired_token_id: token.id,
        expired_at: token.expires_at,
      },
    }];
  });
  if (auditEvents.length > 0) {
    const { error: auditError } = await supabase
      .from("lodge_email_audit_events")
      .insert(auditEvents);
    if (auditError) throw auditError;
  }

  return insertedJobs?.length ?? 0;
}

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
  secureActionCode = "",
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

  if (job.notification_type === "external_link_failure") {
    const linkName = payloadString(job.payload, "link_name") ||
      "External website";
    const targetUrl = payloadString(job.payload, "target_url");
    const failureReason = payloadString(job.payload, "failure_reason");
    const detectedAt = payloadString(job.payload, "first_failed_at");

    return renderExternalLinkAlertEmail({
      linkName,
      targetUrl,
      failureReason,
      detectedAt,
      siteUrl,
    });
  }

  if (job.notification_type === "mailroom_draft_ready") {
    const importId = payloadString(job.payload, "import_id");
    const summary = payloadPlainText(job.payload, "summary").slice(0, 1000);
    const sourceIssuer = payloadString(job.payload, "source_issuer");
    const processingMode = payloadString(job.payload, "processing_mode") ||
      "active";
    const categories = payloadStringArray(job.payload, "classification_tags")
      .map((value) => value.replaceAll("_", " "));
    const reviewUrl = `${
      siteUrl.replace(/\/$/, "")
    }/admin/communications?mailroom=${encodeURIComponent(importId)}`;

    return renderBrandedEmail({
      subject: `${
        processingMode === "shadow"
          ? "Shadow Mailroom result"
          : "Mailroom draft ready"
      }${sourceIssuer ? `: ${sourceIssuer}` : ""}`,
      preheader: summary ||
        "An authenticated Lodge Mailroom message is ready for review.",
      eyebrow: processingMode === "shadow"
        ? "Mailroom shadow test"
        : "Lodge Mailroom",
      heading: processingMode === "shadow"
        ? "A shadow-classification result is ready"
        : "A Mailroom draft is ready for review",
      paragraphs: [
        processingMode === "shadow"
          ? "Mailroom classified this authenticated message in shadow mode. Review the result for accuracy; shadow drafts cannot be published."
          : "Mailroom prepared proposed website actions from an authenticated message. Nothing has been published. Review, edit, approve, or reject each proposed action on the website.",
        ...(summary ? [summary] : []),
      ],
      details: [
        ...(sourceIssuer
          ? [{ label: "Issuing organization", value: sourceIssuer }]
          : []),
        ...(categories.length > 0
          ? [{ label: "Proposed categories", value: categories.join(", ") }]
          : []),
        {
          label: "Publication",
          value: processingMode === "shadow"
            ? "Locked for testing"
            : "Awaiting human approval",
        },
      ],
      cta: { label: "Review Mailroom draft", url: reviewUrl },
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

  if (job.notification_type === "member_activation_invitation") {
    const memberName = payloadString(job.payload, "member_name") || "Brother";
    const lodgeEmail = payloadString(job.payload, "lodge_email");
    const activationUrl = `${siteUrl.replace(/\/$/, "")}/activate`;

    return renderBrandedEmail({
      subject: "Activate your Carleton Lodge website membership",
      preheader:
        "Activate whenever you are ready; these instructions do not expire.",
      eyebrow: "Member website access",
      heading: `Your Lodge membership is ready online, ${memberName}`,
      paragraphs: [
        "Carleton Lodge now has a secure members' website for the Lodge calendar, summons, member directory, documents, and other Lodge information.",
        "When you are ready, open the activation page and enter this personal email address. The website will send you a fresh six-digit code at that time. This instruction email does not expire, and you can request another code whenever you need one.",
        lodgeEmail
          ? `Your personal Lodge mailbox, ${lodgeEmail}, has also been created. After activating your website membership, open My Lodge → Lodge Email to accept the member email agreement and choose a separate mailbox password.`
          : "Your personal Lodge mailbox is being prepared and will appear under My Lodge when it is ready.",
      ],
      details: [
        { label: "Your sign-in email", value: job.recipient_email },
        ...(lodgeEmail
          ? [{ label: "Your personal Lodge email", value: lodgeEmail }]
          : []),
        { label: "Activation page", value: activationUrl },
      ],
      cta: { label: "Activate my membership", url: activationUrl },
      closing:
        "Fraternally,\nBro. Jeramy Ratelle\nWebmaster\nCarleton Lodge No. 465",
      siteUrl,
    });
  }

  if (job.notification_type === "member_access_code") {
    if (!secureActionCode) {
      throw new Error("The one-time member access code was not generated");
    }

    const memberName = payloadString(job.payload, "member_name") || "Brother";
    const intent = payloadString(job.payload, "intent");
    const isActivation = intent === "activation";
    const destination = `${siteUrl.replace(/\/$/, "")}${
      isActivation ? "/activate" : "/my-lodge"
    }`;

    return renderBrandedEmail({
      subject: isActivation
        ? "Your Carleton Lodge activation code"
        : "Your Carleton Lodge sign-in code",
      preheader: `Your one-time code is ${secureActionCode}.`,
      eyebrow: isActivation ? "Membership activation" : "Member sign in",
      heading: isActivation
        ? `Your activation code, ${memberName}`
        : `Your sign-in code, ${memberName}`,
      paragraphs: [
        `Enter the six-digit code below on the Carleton Lodge website. It can be used once and is valid only for a short time.`,
        "If you did not request this code, you can safely ignore this message. Never forward or share the code.",
      ],
      details: [{ label: "Your code", value: secureActionCode }],
      cta: {
        label: isActivation
          ? "Return to activation"
          : "Return to member sign in",
        url: destination,
      },
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
    const isCorrectedInvitation = payloadBoolean(
      job.payload,
      "incident_resend",
    );
    const permissionSummary = payloadStringArray(job.payload, "permissions");
    const baseAccess = [
      "Lodge calendar and event submissions",
      "Summons and lodge notices",
      "Members directory",
      "Document library",
      "Member photo gallery",
    ].join("\n");

    return renderBrandedEmail({
      subject: isCorrectedInvitation
        ? "Corrected Carleton Lodge account setup link"
        : "Welcome to the Carleton Lodge members' website",
      preheader: isCorrectedInvitation
        ? "Please use this corrected, secure link to finish setting up your account."
        : "Your lodge website account and carpmasons.ca email are ready for setup.",
      eyebrow: isCorrectedInvitation
        ? "Corrected setup link"
        : "Member welcome",
      heading: isCorrectedInvitation
        ? `A corrected setup link for you, ${memberName}`
        : `Welcome, ${memberName}`,
      paragraphs: [
        ...(isCorrectedInvitation
          ? [
            "The account-setup link in the earlier message was incorrect. Please disregard that message and use the secure button below. I apologize for the error.",
          ]
          : []),
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
      closing: isCorrectedInvitation
        ? "Fraternally,\nBro. Jeramy Ratelle\nWebmaster, Carleton Lodge No. 465"
        : undefined,
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
    const activationWindow = activationWindowFromPayload(job.payload);
    const isReminder = payloadBoolean(job.payload, "activation_reminder") ||
      activationWindow > 1;
    const isFinalReminder = activationWindow === 3;
    return renderBrandedEmail({
      subject: isFinalReminder
        ? `Final reminder: Activate the ${displayName} Lodge mailbox`
        : isReminder
        ? `Reminder: Activate the ${displayName} Lodge mailbox`
        : `Activate the ${displayName} Lodge mailbox`,
      preheader: isFinalReminder
        ? `Your final 72-hour activation window for ${lodgeEmail} is ready.`
        : isReminder
        ? `A new 72-hour activation window for ${lodgeEmail} is ready.`
        : `Your 72-hour activation window for ${lodgeEmail} is ready.`,
      eyebrow: isFinalReminder
        ? "Final officer account reminder"
        : isReminder
        ? "Officer account reminder"
        : "Officer account",
      heading: isFinalReminder
        ? `Final reminder for your ${displayName} mailbox`
        : isReminder
        ? `A new ${displayName} activation link is ready`
        : `Your ${displayName} mailbox is ready`,
      paragraphs: [
        `${memberName}, Carleton Lodge No. 465 has assigned you temporary access to its ${displayName} mailbox.`,
        "This mailbox belongs permanently to the Lodge and retains its existing messages, folders, attachments, and correspondence when office holders change.",
        ...(isReminder
          ? [
            "The previous secure activation link expired before the mailbox was claimed. This message contains a new one-time link that remains valid for a complete 72-hour window.",
          ]
          : [
            "Use the secure button below to review the Officer and Functional Email Account Agreement and choose a new mailbox password. The one-time link remains valid for 72 hours.",
          ]),
        ...(isFinalReminder
          ? [
            "This is the final automated activation reminder. If this link expires, contact the Lodge Webmaster through support@carpmasons.ca to restart the claim process.",
          ]
          : []),
      ],
      details: [
        { label: "Lodge role", value: displayName },
        { label: "Lodge mailbox", value: lodgeEmail },
        { label: "Ownership", value: "Carleton Lodge No. 465" },
        { label: "Access", value: "Temporary while assigned to this role" },
        {
          label: "Activation window",
          value: `${activationWindow} of 3 · valid for 72 hours`,
        },
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

  let activationRemindersQueued = 0;
  try {
    activationRemindersQueued = await queueDueRoleMailboxActivationReminders(
      supabase,
      new Date().toISOString(),
    );
  } catch (reminderError) {
    // A reminder scan must never prevent already-queued transactional email
    // from being delivered. The next scheduled run retries the scan.
    console.error(
      "Could not queue role mailbox activation reminders:",
      reminderError instanceof Error
        ? reminderError.message
        : String(reminderError),
    );
  }

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
  let cancelled = 0;

  for (const job of jobs) {
    try {
      let secureActionUrl = "";
      let secureActionCode = "";
      if (job.notification_type === "member_access_code") {
        const { data: linkData, error: linkError } = await supabase.auth.admin
          .generateLink({
            type: "magiclink",
            email: job.recipient_email,
          });

        if (linkError) throw linkError;
        const properties = linkData.properties as { email_otp?: string };
        secureActionCode = properties.email_otp ?? "";
        if (!secureActionCode) {
          throw new Error("Supabase Auth did not return a one-time email code");
        }
      } else if (job.notification_type === "member_account_invitation") {
        const { data: linkData, error: linkError } = await supabase.auth.admin
          .generateLink({
            type: "recovery",
            email: job.recipient_email,
            options: {
              redirectTo: ACCOUNT_SETUP_REDIRECT_URL,
            },
          });

        if (linkError) throw linkError;
        const generatedActionLink = linkData.properties?.action_link ?? "";
        if (!generatedActionLink) {
          throw new Error("Supabase Auth did not return an account setup link");
        }
        secureActionUrl = validateAccountSetupActionLink(generatedActionLink);
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

        if (
          purpose === "ROLE_ACTIVATION" &&
          !(await roleMailboxActivationIsStillPending(
            supabase,
            accountId,
            memberId,
          ))
        ) {
          const { error: cancellationError } = await supabase
            .from("notification_outbox")
            .update({
              status: "cancelled",
              locked_at: null,
              last_error:
                "Role mailbox assignment is no longer pending for this recipient",
            })
            .eq("id", job.id);
          if (cancellationError) throw cancellationError;
          cancelled += 1;
          continue;
        }

        const rawActionToken = createRawActionToken();
        const tokenHash = await sha256(rawActionToken);
        const activationWindow = activationWindowFromPayload(job.payload);
        const expiresInHours = purpose === "ROLE_ACTIVATION"
          ? ROLE_MAILBOX_ACTIVATION_WINDOW_HOURS
          : 2;
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
            activation_window: purpose === "ROLE_ACTIVATION"
              ? activationWindow
              : 1,
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

      const rendered = renderEmail(
        job,
        siteUrl,
        secureActionUrl,
        secureActionCode,
      );
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

  return jsonResponse(req, {
    claimed: jobs.length,
    sent,
    failed,
    cancelled,
    activationRemindersQueued,
  });
});
