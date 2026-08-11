# Intelligent Lodge Mailroom

## Intake address

The public intake address is `mailroom@carpmasons.ca`. MXroute must forward it
to `mailroom@inbound.carpmasons.ca`, the existing Resend receiving subdomain.
Resend sends signed `email.received` webhooks to `cl-email-webhook`; no mailbox
polling process or second inbox provider is required.

The Edge Function defaults are:

- `MAILROOM_PUBLIC_ADDRESS=mailroom@carpmasons.ca`
- `MAILROOM_RECIPIENT=mailroom@inbound.carpmasons.ca`
- `MAILROOM_AUTOMATION_MODE=manual|shadow|active`

`manual` captures eligible messages without queueing them, `shadow` prepares
classification-only drafts that cannot publish, and `active` prepares normal
review drafts. Publication always requires an authorised human approval.

## Trust boundary

Automatic preparation requires all of the following:

1. the signed provider webhook is valid and recent;
2. the message reached the designated Mailroom recipient;
3. the exact forwarding address is active in `trusted_email_senders`; and
4. Authentication-Results reports DMARC pass, or both DKIM and SPF pass.

The forwarding secretary is a trusted conduit, not proof of authorship. The
classifier records the original issuing lodge or organization separately.
Email, attachment text, and model output are untrusted data and cannot call
tools or publish records.

## Preparation and routing

Mailroom first classifies the subject, body, and attachment metadata. Supported
attachments are opened only when required to classify or accurately extract a
proposed action. Supported source files and an email-body provenance copy are
stored privately under `summons-uploads/mailroom/{import-id}/`. Each source is
hashed with SHA-256. OpenAI Responses requests use strict structured output and
`store: false`.

One message may propose multiple independently removable actions:

- Carleton or visiting-lodge summons;
- Carleton or District calendar events, including event-only notices;
- memorial or general announcements;
- Library items with source, summary, tags, rights review, and Lodge Guide
  controls;
- sensitive hold; or
- no action.

Visiting material must match the approved `district_lodges` directory. Only
Ottawa Districts 1 and 2 are valid. Outside-scope material is held and the
database approval function rejects District publication from such an import.
District event records do not require a summons record.

## Review and publication

Communications administrators receive a direct review link when a draft is
ready. The reviewer can edit or remove every summons, event, notice, and Library
item. A single transaction validates permissions, district scope, privacy,
notification switches, rights controls, and equivalent records before creating
the selected records.

Defaults are enforced after review:

- Carleton summons/events: member notifications and Lodge Guide enabled.
- District summons/events: no second email; members-only District records;
  Lodge Guide enabled after approval unless the reviewer opts out.
- Memorial notices/service events: members-only, no notification by default,
  expiry required, never Lodge Guide.
- Education: no notification; never Lodge Guide until sharing rights are
  reviewed and the reviewer opts in.
- Sensitive/no-action material: no publishable actions.

Exact message duplicates and repeated summons attachments are held. Equivalent
events and summons issues are reused instead of creating duplicate records.

## Reliability and retention

`carletonlodge-process-mailroom` runs every two minutes. Queue claims use
`FOR UPDATE SKIP LOCKED`; temporary provider, storage, and extraction failures
retry with exponential backoff. Permanent failures remain visible with manual
retry and rejection controls.

Approved source material is retained for provenance. Rejected, ignored, failed,
duplicate, and unactioned content is retained for one year. The daily
`carletonlodge-purge-mailroom` job then removes private source files and purges
message subject, body, headers, raw provider payload, and attachment metadata,
while retaining minimal audit fields and hashes. Memorials expire from normal
member display but remain in the restricted approval record.

## Rollout

1. Configure the MXroute forwarder, but leave automation in `manual`.
2. Add the Secretary's exact sending address as a trusted sender.
3. Set `MAILROOM_AUTOMATION_MODE=shadow` and process at least 20 representative
   historical messages: Carleton and District summons, event-only notices,
   memorials, education, mixed newsletters, private mail, duplicates, and
   unsupported jurisdictions.
4. Verify classifications, dates, district matches, privacy, notification
   defaults, Lodge Guide inclusion, duplicates, expiry, and partial approval.
5. Reject the shadow drafts after recording results. Shadow drafts cannot be
   published.
6. Set `MAILROOM_AUTOMATION_MODE=active` only after the review threshold passes.

## References

- Resend receiving: <https://resend.com/docs/dashboard/receiving/introduction>
- Resend attachments: <https://resend.com/docs/dashboard/receiving/attachments>
- OpenAI file inputs: <https://developers.openai.com/api/docs/guides/file-inputs>
- OpenAI structured outputs: <https://developers.openai.com/api/docs/guides/structured-outputs>
- Supabase scheduled functions: <https://supabase.com/docs/guides/functions/schedule-functions>
