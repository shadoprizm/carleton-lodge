# Lodge Email Governance and Handover

This document is the maintainer runbook for Carleton Lodge No. 465's `@carpmasons.ca` email system. MXroute remains the mailbox host. The website stores governance and authorization records; it does not store or inspect mailbox contents.

## Account ownership model

- A `MEMBER` mailbox, such as `jeramy.ratelle@carpmasons.ca`, is issued to one verified Lodge member and is never transferred to another person.
- An `OFFICER` or `FUNCTIONAL` mailbox, such as `webmaster@carpmasons.ca`, belongs permanently to Carleton Lodge and its configured Lodge position. Only its temporary authorized holder changes.
- A member may hold a personal mailbox and one or more role mailboxes. Each account has its own password and agreement receipt.
- Mailbox passwords, raw action tokens, and MXroute administrative credentials are never stored in application tables or audit events.

The canonical application records are `lodge_email_accounts`, `officer_mailbox_assignments`, `officer_email_handovers`, `email_policy_versions`, `email_agreement_acceptances`, `email_account_action_tokens`, and `lodge_email_audit_events`. Legacy mailbox columns on `lodge_members` remain compatibility mirrors for personal accounts.

## MXroute integration

All provider calls are isolated in `supabase/functions/_shared/lodge-email-provider.ts`. User-facing connection details are centralized in `supabase/functions/_shared/lodge-email-settings.ts`.

The current MXroute API supports:

- creating a mailbox;
- retrieving mailbox status;
- changing a mailbox password;
- changing quota and daily send limit;
- deleting a mailbox (implemented by the provider, but deliberately not exposed by Lodge administration).

The current API does not expose standard-mailbox suspend/unsuspend, session revocation, or app-password revocation. The application never claims these operations succeeded. Suspension, vacancy, and handover remove website authorization and immediately rotate the mailbox password. An audit warning records the provider limitation because a previously authenticated client session may continue until MXroute expires it.

MXroute operations preserve existing mailboxes. Provision/Verify first checks whether the address exists and never deletes or recreates it when found.

### Required server-side secrets

Configure these only as Supabase Edge Function secrets:

```text
MXROUTE_API_SERVER=sunfire.mxrouting.net
MXROUTE_API_USERNAME=<MXroute API username>
MXROUTE_API_KEY=<MXroute API key>
EMAIL_PROVIDER=resend
EMAIL_API_KEY=<Resend key>
EMAIL_FROM=Carleton Lodge No. 465 <help@carpmasons.ca>
SITE_URL=https://www.carpmasons.ca
```

The standard Supabase `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` values are supplied to deployed Edge Functions by Supabase. Never expose service-role or MXroute credentials in `VITE_*` variables.

Connection settings are currently Webmail `https://webmail.mxroute.com/`, IMAP `sunfire.mxrouting.net:993` with SSL/TLS, and SMTP `sunfire.mxrouting.net:465` with SSL/TLS and authentication.

## Personal mailbox activation

1. Every roster member receives a personal Lodge mailbox. Sending activation instructions provisions the mailbox first; a verified self-service activation also repairs a missing mailbox automatically.
2. `provisionPersonalMailbox` deterministically reserves the member address, checks database and MXroute collisions, preserves an existing governed mailbox, or creates a locked MXroute mailbox with the member's configured quota and send limit.
3. The member activates website access at `/activate` with a fresh six-digit code sent to the personal email recorded on the Lodge roster. The non-expiring instruction email and website activation remain distinct from the short-lived verification code.
4. After signing in, the member opens **My Lodge → Lodge Email**, reviews the active Member Email Account Agreement, deliberately checks the acknowledgement, and chooses a separate eight-or-more-character mixed-case-and-number mailbox password when credentials are required.
5. `activate-member-mailbox` independently verifies the authenticated member, account ownership, policy version, and acknowledgement. It submits the new password directly to MXroute and immediately discards it.
6. The application creates an immutable acceptance receipt, activates the canonical and compatibility records, writes audit events, and sends confirmation.

Existing active MXroute mailboxes are associated in place. Their contents and passwords are untouched; the member only accepts outstanding terms.

Administrators can recover missing personal mailboxes from **Administration → Lodge Email → Personal Mailboxes**. Recovery runs in small, idempotent batches, reports each failure, preserves existing provider mailboxes, and never sends bulk member email. Previously sent website activation instructions remain valid and do not need to be resent.

## Role mailbox activation and handover

The admin page is **Administration → Lodge Email**.

For a new or vacant role mailbox:

1. Add or select the role configuration.
2. Choose **Provision** or **Verify**. This is non-destructive.
3. Choose **Assign**, select a verified member, review the confirmation, and confirm.
4. The system rotates MXroute credentials, creates a pending assignment, and sends an expiring one-use activation link to the member's verified personal/contact email.
5. The member accepts the separate Officer and Functional Email Account Agreement and chooses a new mailbox password.
6. The account and assignment become active. The role mailbox appears separately from the member's personal mailbox.

For a successor, choose **Handover**. The state machine removes the outgoing member's website authorization first, ends the previous assignment, rotates the existing mailbox password, creates the successor's pending assignment, and queues the invitation. Inbox, Sent, folders, attachments, and correspondence remain in the same MXroute mailbox.

Open handovers use these controlled states: `PENDING_CONFIRMATION`, `INITIATED`, `REVOKING_ACCESS`, `ROTATING_CREDENTIALS`, `WAITING_FOR_ACCEPTANCE`, `WAITING_FOR_PASSWORD`, `ACTIVE`, `FAILED`, and `CANCELLED`. Database triggers reject invalid transitions and duplicate open handovers or assignments.

## Failed handover recovery

If MXroute rotation or invitation preparation fails, the handover is not marked complete. The admin table shows **Action required**, the detail view records the failed step, and the account audit explicitly warns if old provider credentials may still work.

Use **Retry** after correcting the provider or member-contact issue. Retry is idempotent: it reuses the same handover, increments its retry counter, rotates credentials again, and produces a new invitation token while revoking prior unused tokens. Do not edit handover rows directly.

## Suspension, vacancy, and emergency override

Use the existing admin controls; database manipulation is not required:

- **Suspend** requires confirmation and a reason, rotates credentials, removes active access, and preserves the mailbox.
- **Reactivate** sends the authorized member a secure recovery link.
- **Vacate** requires confirmation and a reason, ends the assignment, rotates credentials, and leaves the mailbox unassigned without deletion.
- **Handover/Assign** covers resignation, removal, death, incorrect assignment, acting appointment, and normal officer transition. Put the circumstance in the required reason field.

Every override is audited. Personal mailboxes are never handed to a successor, and a role action never changes the holder's personal Lodge mailbox.

## Agreements and receipts

Member and officer policies are separate, versioned, and immutable after creation. The admin page creates a new version rather than editing accepted text. A future effective date is supported. If **Require reacceptance** is selected, affected accounts return to an agreement-required state for that exact version. Otherwise a prior acceptance remains valid.

Members and administrators can load the durable receipt. It contains the member, mailbox, optional position, title, version, effective date, acceptance time, exact acknowledgement, and exact policy text. The view is print-friendly.

## Secure action links

Activation and reset links use cryptographically random tokens. Only a SHA-256 hash is stored. Tokens are scoped to an account, member, purpose, and optional handover; they expire, are single-use, and are revoked when a replacement is generated. The raw token is carried in the URL fragment so it is not sent in the initial HTTP request or referrer. Passwords are never placed in links or notification records.

## Adding a future role mailbox

1. Ensure the Lodge position exists in the roster position list.
2. Open **Administration → Lodge Email → Add Role Mailbox**.
3. Select the position, enter a unique `@carpmasons.ca` address and display name, choose Officer or Functional, and optionally select an initial verified holder.
4. Save, then choose **Provision**. Confirm that MXroute reports the mailbox.
5. Choose **Assign** or **Send Invite** as appropriate.

The address and position form the permanent identity and cannot be casually rewritten. **Configure** can update the display name, agreement requirement, and enabled/archive state. A held role must first be vacated before its configuration is disabled. Destructive mailbox deletion is intentionally absent.

## Audit and privacy

Lifecycle audit events record provisioning, invitation, acceptance, activation, reset, suspension/reactivation, assignment, handover steps, rotation, failure/retry, override, and policy publication. Audit metadata excludes passwords, raw tokens, and administrative credentials.

The website does not copy, index, or display mailbox messages. Legitimate continuity access remains an MXroute mailbox-administration matter governed by the accepted agreements.

## Deployment order

1. Apply `supabase/migrations/20260809184357_lodge_email_governance.sql` through the normal Supabase migration process.
2. Deploy `manage-member-login`, `activate-member-mailbox`, `manage-lodge-email`, and `cl-process-notifications` with their shared dependencies.
3. Deploy the frontend.
4. In the admin page, Provision/Verify the six initial role mailboxes. Only send invitations to intended, verified holders.
5. Run the personal activation, role activation, reset, receipt, and reversible handover acceptance checks. Never use an actual member as a temporary handover target without explicit authorization.

## Operational cautions

- Never delete/recreate a mailbox to fix a governance record.
- Never send or ask an administrator to choose a member's mailbox password.
- Never place a service-role or MXroute secret in frontend environment variables.
- Never directly update a handover state or agreement receipt in production.
- A member's website password and mailbox password are deliberately separate.
