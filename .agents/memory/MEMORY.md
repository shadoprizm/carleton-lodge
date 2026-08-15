# Memory

## Architecture
- [2026-08-14] Summons publication notifications are explicit opt-in; summons PDFs are the source of truth and appear in the protected Library Summons category through one-to-one linked document records.
- [2026-08-08] Build “Ask Carleton” only after the member knowledge/search foundation: authenticated-first, read-only, permission-aware, grounded in approved lodge sources, citation-required, explicit uncertainty, and human escalation; it cannot take administrative actions or expose private/admin content.
- [2026-07-25] All new calendar entries use `event_submissions`; only an authorized approval atomically creates a published `events` row.
- [2026-07-25] Events approval is a delegated `can_approve` capability independent of Events read/write access; full admins retain implicit approval.
- [2026-07-25] Resend is the active email provider: `carpmasons.ca` sends as `notifications@carpmasons.ca`, `inbound.carpmasons.ca` receives through a signed webhook, and a Vault-backed Supabase Cron job processes the outbox every minute.
- [2026-07-25] All lodge transactional emails use the shared responsive HTML/plain-text template in `supabase/functions/_shared/branded-email.ts`, aligned to the carpmasons.ca navy, gold, serif, and lodge-seal visual system.
- [2026-07-26] Member account emails never contain administrator-created passwords; Members writers queue a branded welcome email whose single-use Supabase Auth link is generated only at send time and requires the member to choose a password.

## Open questions
- Consider a named website/community-inquiry steward role with a dedicated address for prospective-member and website questions; no implementation or routing decision yet.
- Decide which opt-in broadcasts beyond approval workflow should be active: approved new events, event changes/cancellations, summons, and contact/inbound routing.
