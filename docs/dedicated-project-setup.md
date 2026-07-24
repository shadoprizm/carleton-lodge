# Carleton Lodge — Move to a Dedicated Supabase Project

This runbook migrates the lodge site off the shared **Shared A** project
(`qbflbzgfbmipibvizvcj`, schema `carletonlodge`) onto its **own** Supabase
project. It also folds in every fix from the launch audit so the new project
starts clean.

The goal: remove the shared blast radius (one bad migration / `db reset` /
quota trip / billing lapse on any of the four tenants currently takes the
lodge down with it), get the standard Supabase CLI workflow back, and stop
having to hand-rewrite `public.` → `carletonlodge.` on every migration.

> **Status:** groundwork / plan. Nothing here is destructive to the live site
> until Phase 9 (cutover). Do the earlier phases at your leisure; the current
> site keeps running on Shared A the whole time.

---

## BUILD STATUS (updated during migration)

The dedicated project **`carleton-lodge`** (`isnxsygngysxgzeuhmjm`, ca-central-1)
is built and verified. Live site on Shared A is untouched.

**Done & verified:**
- Schema: 16 tables, 105 RLS policies, 11 functions, 8 triggers — a faithful
  copy of the live `carletonlodge` schema, de-tenanted to `public`, with the
  audit fixes baked in (SEC-1 profiles guard, SEC-8 email-confirm link,
  hardened function search_paths, tighter function grants).
- Storage: 4 buckets (`summons-uploads`/`lodge-documents` private,
  `lodge-photos`/`event-assets` public) + access policies.
- Content data: positions, categories, history eras+entries, album+photos,
  events, summons, documents, and the 18-row roster — **row counts match and
  rich-text content is md5-identical to live**. Member→profile links nulled
  (rebuilt at re-provisioning).
- Edge functions: all 4 deployed, de-tenanted, with the SEC-3 fix in
  `manage-member-login`. The repo copies under `supabase/functions/` now match
  the deployed versions (schema config dropped; SEC-3 guards in
  `manage-member-login`), so a `supabase functions deploy` won't regress them.
- Frontend: schema is env-driven (`VITE_SUPABASE_SCHEMA`, default `public`),
  metadata points at `carpmasons.ca`.

**New project connection (for Vercel at cutover):**
- `VITE_SUPABASE_URL = https://isnxsygngysxgzeuhmjm.supabase.co`
- `VITE_SUPABASE_ANON_KEY = ` (legacy anon key — copy from dashboard → API)
- Do **not** set `VITE_SUPABASE_SCHEMA` (defaults to `public`).

**Remaining before cutover (needs dashboard / CLI / you):**
1. **Copy the storage FILES.** Only the DB rows were copied; the actual photo,
   summons-PDF, and document binaries still live in Shared A's buckets. Copy the
   objects across (dashboard download/upload for the ~13 files, or a Storage-API
   script). Until then, images/PDFs on the new project will 404.
2. **Set the `GOOGLE_PLACES_API_KEY`** secret on the new project (Edge Functions
   → Secrets) so address autocomplete works.
3. **Auth settings** (Authentication → Providers/URL config): disable public
   sign-ups, require email confirmation, enable leaked-password protection, set
   Site URL + redirect URLs to `https://carpmasons.ca`, configure SMTP.
4. **Vercel:** point `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` at the new
   project and deploy the `claude/masonic-lodge-audit-hcm4bh` branch.
5. **Bootstrap admin + re-provision members:** create your own login, set your
   `profiles.is_admin = true`, then issue logins for members; re-grant
   `admin_section_permissions` and re-link the roster by email.
6. **Cutover DNS** to the new deployment; keep Shared A as rollback for ~2 weeks.

---

## Execution — chosen method: CLI dump / restore

We build the new project fully in parallel and only switch at the end. The live
site on Shared A is untouched until cutover, and Shared A stays intact as an
instant rollback for ~2 weeks after.

**Division of labour**
- **Owner (local, has DB passwords):** runs `supabase db dump` and the `psql`
  loads. Passwords never go into chat — copy the connection URIs from the
  dashboard.
- **Assistant:** de-tenants the dump (`carletonlodge` → `public`), bakes in the
  audit fixes, redeploys the four edge functions (no DB password needed),
  supplies the auth-remap SQL, and provides verification queries.

**Stages (each verified before the next):**
1. **Schema dump** from Shared A (`--schema carletonlodge`) → assistant
   de-tenants + reviews → load into new project.
2. **Content data** (no auth dependency): `lodge_positions`, `events`,
   `summons`, `document_categories`, `documents`, `history_eras`,
   `history_entries`, `history_milestones`, `photo_albums`, `photos`, and
   `lodge_members` **with `linked_profile_id` set NULL**. Load these first.
3. **Storage objects**: copy `summons-uploads`, `lodge-documents`,
   `lodge-photos` (now **private**), `event-assets` to the new project's buckets.
4. **Re-provision members** in the new project (admin issues temp passwords).
   This creates fresh `auth.users` + `profiles` rows — **with new UUIDs**.
5. **Auth-remap** (assistant SQL): because member UUIDs change, re-establish
   `admin_section_permissions` and re-link `lodge_members.linked_profile_id`
   **by matching email**, not by copying old IDs. Do NOT bulk-copy `profiles`,
   `notification_preferences`, or `admin_section_permissions` raw — their IDs
   won't line up with the new auth users.
6. **Edge functions** redeployed to the new project (assistant), schema config
   dropped since tables are now in `public`.
7. **Auth config**: disable public sign-ups, require email confirmation, enable
   leaked-password protection, set Site URL + redirect URLs to `carpmasons.ca`,
   configure SMTP.
8. **Stage + smoke-test** on a preview URL, then **cutover** (env/domain swap),
   then keep Shared A read-only for 2 weeks.

**Why not bulk-copy auth:** the new project has its own `auth.users`. Copying
password hashes across projects is fragile; the membership is small and
admin-provisioned, so re-issuing temp passwords (Stage 4) is both safer and
simpler. The only consequence is that ID-based links must be rebuilt by email
(Stage 5).

---

## 0. Decisions to confirm before starting

| Decision | Recommendation | Why it matters |
|---|---|---|
| **Schema layout** | Move tables to the standard **`public`** schema in the new project | A dedicated project has no reason to keep the `carletonlodge` schema. `public` means the CLI "just works" and the app drops its `db: { schema }` config. |
| **Plan / cost** | Confirm whether a 2nd project stays on Free or needs Pro (~US$25/mo) | Supabase Free allows 2 active projects per org; you already run many. Check the org before creating. |
| **Auth users** | **Re-provision** members (re-issue temp passwords) rather than export/import `auth.users` | The membership is small and admin-provisioned already. Re-issuing sidesteps the fragile password-hash export. |
| **Domain** | Decide the permanent domain now | The live site advertises `concept.carpmasons.com` — a name that reads like a preview. Pick the real one before cutover so meta tags + auth redirect URLs are set once. |
| **Content data** | Copy events / history / summons / documents / photos / roster | These are small tables + a handful of storage objects; a straight export/import is fine (Phase 6). |

Answer these four and the rest of the runbook is mechanical.

---

## 1. Create the project

1. Supabase Dashboard → **New project** in the same org.
2. Name: `carleton-lodge`. Region: **ca-central-1** (closest to Carp/Ottawa —
   lower latency than the current `us-east-2`).
3. Save the new project ref, URL, anon (publishable) key, and service-role key.
4. Enable **Point-in-Time Recovery / daily backups** (Settings → Database).

---

## 2. Export the current schema (source of truth = the LIVE DB, not the repo)

The repo migrations were hand-rewritten before being applied, so they are **not**
a reliable mirror of production. Dump the real live schema instead:

```bash
# Auth against the Shared A project, then dump ONLY the carletonlodge schema.
supabase db dump \
  --project-ref qbflbzgfbmipibvizvcj \
  --schema carletonlodge \
  -f carletonlodge_dump.sql
```

Then de-tenant the dump to `public` (moving to the standard schema):

```bash
sed -e 's/\bcarletonlodge\./public./g' \
    -e 's/SCHEMA carletonlodge/SCHEMA public/g' \
    carletonlodge_dump.sql > baseline_public.sql
# Review by hand: auth.*, storage.*, extensions.* must remain untouched.
```

Keep `baseline_public.sql` in version control as the new project's first
migration (`supabase/migrations/00000000000000_baseline.sql`).

---

## 3. Bake the audit fixes into the baseline

Apply these edits to `baseline_public.sql` **before** first apply, so the new
project is born clean. (Items marked ✅ are already committed on the audit
branch and will carry over automatically once the schema is `public`.)

- ✅ **SEC-1 profiles privilege guard** — the `protect_profile_privileged_columns`
  trigger (see `supabase/migrations/20260724120000_*`). Keep it.
- **SEC-5 private photos** — create `lodge-photos` as a **private** bucket
  (`public = false`) and serve non-public albums via signed URLs (same pattern
  the document library already uses). Drop the broad "anyone can list" SELECT
  policy; the advisor flagged that public bucket as listable.
- **SEC-6 contact spam** — keep the anon INSERT, but add server-side rate
  limiting (route through an edge function) and a honeypot/CAPTCHA on the form.
- **SEC-8 auto-link** — in `handle_new_user`, only link a roster row once
  `NEW.email_confirmed_at IS NOT NULL`.
- **ARCH-1 cross-tenant leak** — `get_admin_user_last_signins` currently returns
  rows for *all* users in `auth.users`; in a dedicated project that's only lodge
  members, so the leak disappears for free. Keep the admin self-gate.
- **Hygiene** — `REVOKE EXECUTE` on the trigger-only functions
  (`handle_new_user`, `handle_new_profile_notifications`,
  `protect_profile_privileged_columns`) from `anon` and `authenticated`
  (they should only ever fire as triggers). The advisor flagged these.
- **PII in seed data** — do **not** port the seed migration that hard-codes real
  officer names + mobile numbers. Enter the roster through the admin panel after
  cutover.

---

## 4. Storage buckets

Recreate the four buckets in the new project:

| Bucket | Public? | Notes |
|---|---|---|
| `summons-uploads` | **No** | signed-URL reads (unchanged) |
| `lodge-documents` | **No** | signed-URL reads (unchanged) |
| `lodge-photos` | **No (changed)** | make private; serve via signed URLs so album `visibility` actually protects the bytes |
| `event-assets` | Public OK | scope uploads to editors; add a size cap |

Drop the `CL:` policy-name prefixes — in a single-tenant project they're just
noise. Copy the objects across after buckets exist (Phase 6).

---

## 5. Edge functions (de-tenant + redeploy)

Deploy the four functions to the new project. Because tables now live in
`public`, **remove the `db: { schema: 'carletonlodge' }` option** from each
function's Supabase client (and from `src/lib/supabase.ts`).

| Function | Change |
|---|---|
| `parse-summons` | drop schema config; keep the admin check (the current one queries `profiles` without the schema override — it starts working correctly on `public`) |
| `manage-member-login` | drop schema config; **also apply the SEC-3 fix** (refuse admin targets, verify email matches the member) before redeploying |
| `send-summons-notification` | ✅ already secured on the audit branch; drop schema config; wire a real email provider (Phase 7) |
| `places-autocomplete` | drop schema config; add per-user rate limiting |

Set each function's secrets in the new project (`SUPABASE_SERVICE_ROLE_KEY` is
auto-injected; add `GOOGLE_PLACES_API_KEY`).

---

## 6. Copy content + storage objects

Small tables — export/import via SQL or CSV:
`lodge_positions`, `lodge_members`, `member_profiles`, `events`, `history_eras`,
`history_entries`, `history_milestones`, `summons`, `document_categories`,
`documents`, `photo_albums`, `photos`, `admin_section_permissions`.
(Skip `profiles`, `notification_preferences`, `contact_submissions` — profiles
regenerate on member sign-in; submissions are transient.)

Storage objects: download from Shared A and re-upload to the new buckets (a
short script over the Storage API, or the dashboard for the handful of files).

---

## 7. Auth configuration (new project)

- **Disable public email sign-ups** (you provision members yourself).
- **Require email confirmation.**
- **Enable leaked-password protection** (HaveIBeenPwned) — advisor flagged it off.
- **Redirect URLs / Site URL** → the production domain (Decision 0), not
  `localhost:3000`.
- **Custom SMTP** — the default Supabase email sender is rate-limited and not
  meant for production; configure SMTP (or the email provider from Phase 5) so
  password-reset and summons emails actually deliver.
- Add a **password-reset flow** in the app (`resetPasswordForEmail`) — currently
  missing (audit UX-2).

---

## 8. Frontend / Vercel

1. Point Vercel env vars at the new project:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
2. In `src/lib/supabase.ts`, remove `db: { schema: 'carletonlodge' }` (now `public`).
3. Deploy the audit branch (carries the SEC-2 frontend change + any others).
4. Re-provision members: for each roster entry, use the admin "issue login"
   action to set a temporary password; send it to the member out-of-band.

---

## 9. Cutover

1. Freeze content edits on the old site briefly.
2. Final content + storage sync (Phase 6 delta).
3. Flip the production domain to the new deployment.
4. Smoke-test the flows below.
5. Keep Shared A's `carletonlodge` schema **read-only** for ~2 weeks as a
   fallback, then remove it (drop the schema, its buckets' `CL:` policies, and
   the four lodge edge functions) to fully de-tenant Shared A.

---

## 10. Verify (run after Phases 3, 8, and 9)

- Supabase → **Advisors → Security**: expect zero WARN/ERROR for the lodge
  (leaked-password on, no permissive `USING(true)` writes, private photo bucket).
- Confirm a **non-admin member cannot** `PATCH /profiles {is_admin:true}` (should
  error) — the SEC-1 guard.
- Confirm `send-summons-notification` returns **401/403** to the anon key and a
  **count only** (no email list) to a summons editor.
- Member flows: sign in → forced password change → summons/roster/library load;
  gallery restricted albums are not directly fetchable by URL.
- Admin flows: issue a member login; promote/demote a user; upload a summons PDF.

## 11. Rollback

Until the domain flips (Phase 9) there is nothing to roll back — the live site is
still Shared A. If a problem appears **after** cutover, repoint the domain back to
the old deployment and restore the Vercel env vars to the Shared A values; the
`carletonlodge` schema is still intact for the 2-week fallback window.

---

### Appendix — audit items resolved by this migration

| Audit ID | Item | Resolved by |
|---|---|---|
| SEC-1 | profiles self-escalation | ✅ trigger (baked into baseline) |
| SEC-2 | notification function leak | ✅ secured function (Phase 5) |
| SEC-3 | member-login account takeover | Phase 5 fix before redeploy |
| SEC-5 | members-only photos public | Phase 3/4 private bucket + signed URLs |
| SEC-8 | unconfirmed auto-link | Phase 3 email-confirm check |
| SEC-7 | open sign-ups | Phase 7 disable sign-ups |
| ARCH-1 | shared project / cross-tenant leak | the whole migration |
| PRIV-1 | seeded PII in repo | Phase 3 (don't port seed) |
| UX-2 | no password reset | Phase 7 |

Items **not** covered here (do separately on the app, they're project-agnostic):
favicon + 404 page (UX-1), contact spam UI (SEC-6), timezone/auth-flap bugs,
dependency patches, and making the GitHub repo private + purging
`supabase/.temp/` from history (PRIV-1).
