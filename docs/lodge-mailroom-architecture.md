# Lodge Mailroom architecture

## Decision

Use the existing Resend receiving domain and Supabase webhook. Do not add
Hermes, OpenClaw, a locally hosted agent, or a mailbox-polling process. Resend
already sends a signed `email.received` webhook when mail arrives, so a second
inbox provider would add cost and another failure surface without adding a
needed capability.

AgentMail remains a supported future adapter for two-way, agent-authored email
threads. The webhook normalizer accepts AgentMail's current top-level
`message.received` payload, but AgentMail is not the active provider.

## Names

- **Lodge Mailroom**: the administrative email-import workflow.
- **Lodge Guide**: the member-facing, read-only information assistant. The
  existing internal `ask-carleton` function slug and feature flag remain for
  backward compatibility, but the public label and route are Lodge Guide and
  `/lodge-guide`.

## Workflow

1. The Secretary emails the configured receiving address with a summons PDF.
2. The provider verifies its webhook signature and stores the normalized email
   in `inbound_emails`.
3. An administrator adds the Secretary's exact sending address to
   `trusted_email_senders`. The list starts empty by design.
4. The administrator selects **Prepare draft**. Lodge Mailroom verifies both:
   - the From address is active in the trusted-sender list; and
   - Authentication-Results reports DMARC pass, or both DKIM and SPF pass.
5. The PDF is downloaded from the provider's temporary URL, checked for the
   PDF file signature and 10 MB limit, hashed with SHA-256, and copied to the
   private `summons-uploads` bucket under `mailroom/{import-id}/`.
6. OpenAI's Responses API receives the email body and PDF as untrusted input,
   with `store: false`, and returns a strict structured draft containing:
   - summons title, month, and text;
   - calendar events;
   - announcements;
   - confidence and warnings.
7. A human reviews every field, changes or removes proposed items, and chooses
   **Publish reviewed items** or **Reject draft**.
8. One database transaction publishes the approved summons, document record,
   calendar events, and announcements. Existing database triggers queue email
   notifications for members who opted in.
9. Existing knowledge-index triggers make the approved records available to
   site search and, after its release evaluation, Lodge Guide.

No webhook, model response, or PDF can publish directly.

## Institutional memory

The durable memory is the approved lodge record, not a chatbot transcript.
Each import retains:

- original inbound email and provider message ID;
- trusted sender and email-authentication result;
- source PDF storage path and SHA-256 hash;
- model and prompt version;
- extracted draft and final reviewed payload;
- reviewer and review time;
- IDs of the summons, events, and announcements created.

This supports provenance, correction, duplicate detection, and later quality
evaluation without treating private conversations as lodge knowledge.

## Activation checklist

1. Confirm the Secretary's exact sending address.
2. In **Admin → Communications → Lodge Mailroom**, add it as a trusted sender.
3. Send a non-confidential test email with a representative summons PDF.
4. Prepare the draft and confirm PDF text, dates, times, locations, visibility,
   and announcements against the source.
5. Publish the test only if it is legitimate content; otherwise reject it.
6. Confirm the summons, calendar entries, document, and notification queue.
7. Repeat with at least five historical summons before considering automatic
   draft preparation. Publication should continue to require human approval.

## Privacy and content boundaries

- Do not email passwords, financial details, medical information, modes of
  recognition, or private ritual material to the Mailroom.
- Email and PDF content is sent to OpenAI only when an administrator explicitly
  prepares a draft.
- Lodge Guide remains read-only and permission-aware. It does not use Mailroom
  drafts; it reads only approved, audience-filtered lodge sources.
- Historical inbox messages are not processed automatically.

## Provider references

- Resend receiving: <https://resend.com/docs/dashboard/receiving/introduction>
- Resend received attachments: <https://resend.com/docs/dashboard/receiving/attachments>
- AgentMail webhooks: <https://docs.agentmail.to/webhooks-overview>
- AgentMail verification: <https://docs.agentmail.to/webhook-verification>
- OpenAI file inputs: <https://developers.openai.com/api/docs/guides/file-inputs>
- OpenAI structured outputs: <https://developers.openai.com/api/docs/guides/structured-outputs>
- Supabase scheduled functions, if automatic draft preparation is added later:
  <https://supabase.com/docs/guides/functions/schedule-functions>
