# Calendar approvals and email architecture

## Calendar publication boundary

`event_submissions` is the member-facing write model. Every authenticated lodge
member can create a pending submission and can see their own submissions.

`events` is the published read model. Direct client inserts are denied. An
approval trigger copies a pending submission into `events` in the same database
transaction that records the reviewer, review time, and published event ID.

The delegated Events permission has three independent capabilities:

- **Read**: view the event administration area and submission queue.
- **Write**: edit or delete published events and edit pending submissions.
- **Approve**: approve or reject pending submissions.

Full administrators have all three capabilities implicitly.

## Email boundary

Business transactions never call an email API directly. They insert typed,
idempotent jobs into `notification_outbox`. This prevents a provider outage
from blocking an event submission or approval and provides an auditable retry
history.

`cl-process-notifications` claims jobs with `FOR UPDATE SKIP LOCKED`, renders the
notification template, sends it through the configured provider adapter, and
records the provider message ID or a retryable failure.

All transactional notifications render through
`supabase/functions/_shared/branded-email.ts`. The standard includes:

- Responsive, table-based HTML for broad email-client compatibility.
- A plain-text alternative generated from the same message content.
- Carleton Lodge navy and gold styling, the public lodge seal, and
  email-compatible system fonts that echo the website typography.
- Preheader text, escaped dynamic content, an accessible primary action, and a
  consistent lodge header, signature, and footer.

`cl-email-webhook` verifies Svix signatures before accepting inbound provider
events and stores normalized messages in `inbound_emails`. Both Resend and
AgentMail use Svix-signed webhooks, so the trust boundary is provider-neutral.

The Communications admin permission controls read access to delivery history and
inbound messages. The browser never receives provider API keys, webhook secrets,
or the Supabase service-role key.

## Provider configuration

The worker supports:

- `EMAIL_PROVIDER=resend` with `EMAIL_API_KEY` and `EMAIL_FROM`.
- `EMAIL_PROVIDER=agentmail` with `EMAIL_API_KEY` and `EMAIL_INBOX_ID`.

Both providers use `EMAIL_WEBHOOK_SECRET` for the inbound endpoint.

The recommended starting choice is **Resend** for transactional lodge
notifications and a receiving subdomain such as `inbound.carpmasons.ca`.
Using a subdomain avoids changing the MX records for any existing mailbox on
`carpmasons.ca`. AgentMail remains an option if the lodge later wants an
autonomous inbox that reads and replies to ongoing email threads.

## Production configuration

Resend is the active provider. The production configuration is:

- `carpmasons.ca` is verified for sending as
  `Carleton Lodge No. 465 <notifications@carpmasons.ca>`.
- `inbound.carpmasons.ca` is verified for receiving. Any address on that
  subdomain can receive mail, for example
  `communications@inbound.carpmasons.ca`.
- Resend sends `email.received` events to
  `cl-email-webhook`; the function fetches the complete message before
  normalizing it into `inbound_emails`.
- `cl-process-notifications` runs every minute through the
  `carletonlodge-process-notifications` Supabase Cron job.
- The Cron authorization credential is encrypted in Supabase Vault. Provider
  credentials and the webhook signing secret are encrypted Edge Function
  secrets.
- Namecheap remains the registrar, while Vercel is the authoritative DNS
  provider for `carpmasons.ca`.

## Initially queued notification types

- `event_approval_requested` to full admins and delegated Events approvers.
- `event_submission_approved` to the submitting member.
- `event_submission_rejected` to the submitting member.
- `member_account_invitation` to a roster member when an authorized
  Members administrator creates or resets website access.

`standard_template_preview` is an internal delivery-test type used to verify the
shared template and provider pipeline without implying a real calendar action.

Existing preferences for new-event, event-update, and summons notifications are
intentionally not wired into the outbox yet. Those audience and frequency
decisions can be made without changing the provider or calendar architecture.

## Member account email flow

An administrator with Members write access can create or reset a member's
website access from the lodge roster.

The administrator supplies only the member's email address. The server creates
an unknowable random credential when a new Auth user is required; neither the
administrator nor the member is shown or emailed that value. The member receives
the standard branded welcome email with:

- Their login email and normal member-site capabilities.
- A summary of any full-admin or delegated section permissions currently
  assigned to the profile.
- A temporary, single-use action that signs them in and requires them to choose
  their own password.

The outbox stores member and permission context but never the Supabase Auth
action URL. `cl-process-notifications` generates that recovery URL immediately
before sending, keeps it in memory only, and sends account messages with one
automatic attempt. A failed or expired link is replaced by explicitly sending a
new account email from the roster.

Account-email requests use a browser-generated idempotency key, reject an email
already linked to another roster member, and apply a one-minute resend throttle.
