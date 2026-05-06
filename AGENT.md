# Carleton Lodge — Agent Instructions

> **Read this entire file before writing any code, running any commands, or making any database changes.**

## Project Overview

Carleton Lodge is a private Masonic lodge website (concept.carpmasons.com) built with React/TypeScript, Vite, Tailwind CSS, and Supabase. It provides members with events, summons, document library, photo gallery, history, and admin features.

## Critical: Multi-Tenant Supabase Setup

This project does NOT have its own dedicated Supabase project. It shares a Supabase project called **Shared A** with three other websites using **schema-based multi-tenancy**.

### The Setup

| Tenant | Schema | Site |
|--------|--------|------|
| Carleton Lodge | `carletonlodge` | concept.carpmasons.com |
| Step by Step Photography | `stepbystep` | stepbystepphotography.ca |
| Families and Love | `stepbystep` | familiesandlove.com |
| Astra Web Dev | `astrawebdev` | astrawebdev.com |

**Shared A Project ID:** `qbflbzgfbmipibvizvcj`
**Shared A URL:** `https://qbflbzgfbmipibvizvcj.supabase.co`

All four tenants share one Supabase project, one `auth.users` table, one `storage.objects` table, and one set of edge functions. Each tenant's application tables live in their own PostgreSQL schema.

### What This Means for You

The Supabase client in this app is configured with:

```typescript
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: 'carletonlodge' }
});
```

All PostgREST API calls (`.from('events')`, `.from('profiles')`, etc.) automatically target the `carletonlodge` schema. You do not need to qualify table names in application code.

---

## Database Changes (Migrations)

### DO NOT use `supabase db push`

The Supabase CLI migration system (`supabase db push`, `supabase migration up`) will NOT work with this project. The CLI checks `supabase_migrations.schema_migrations` for migration history, and Shared A's history does not match this repo's migration files. The CLI will either refuse to run or try to apply the entire schema from scratch, which would be catastrophic.

### How to Apply Database Changes

**Step 1:** Write your migration SQL as normal in `supabase/migrations/` for version control.

**Step 2:** Before applying, you MUST rewrite all schema references:

| In your migration | Change to |
|---|---|
| `public.table_name` | `carletonlodge.table_name` |
| `public.function_name()` | `carletonlodge.function_name()` |
| `CREATE TABLE public.` | `CREATE TABLE carletonlodge.` |
| `CREATE FUNCTION public.` | `CREATE FUNCTION carletonlodge.` |
| `ON public.table_name` | `ON carletonlodge.table_name` |
| `SET search_path = public` | `SET search_path = carletonlodge` |
| `SET search_path TO 'public'` | `SET search_path TO 'carletonlodge'` |
| `FROM public.table_name` | `FROM carletonlodge.table_name` |

**Do NOT rewrite these — they are shared and must stay as-is:**
- `auth.users`, `auth.uid()`, `auth.role()`
- `storage.objects`, `storage.buckets`
- `extensions.*` (e.g., `gen_random_uuid()`)
- `pg_catalog.*`, `information_schema.*`
- `cron.*` (pg_cron)

**Step 3:** Apply via one of these methods:
- Paste into the Supabase Dashboard SQL Editor (project: Shared A)
- Run: `supabase db execute --project-ref qbflbzgfbmipibvizvcj < migration.sql`
- Use the Supabase MCP `execute_sql` tool with `project_id: "qbflbzgfbmipibvizvcj"`

### Automated Schema Rewrite

You can programmatically rewrite migrations. Here is a reliable approach:

```bash
# Create a rewritten copy — ALWAYS review before applying
sed \
  -e 's/public\./carletonlodge./g' \
  -e 's/SET search_path = public/SET search_path = carletonlodge/g' \
  -e "s/SET search_path TO 'public'/SET search_path TO 'carletonlodge'/g" \
  supabase/migrations/XXXXXXX_your_migration.sql > /tmp/migration_shared_a.sql
```

**Always review the output.** The sed replacement is aggressive. Manually verify:
- `auth.uid()` was not corrupted
- `storage.objects` was not rewritten
- Extension function calls remain intact
- No double-replacement occurred (e.g., `carletonlodge.carletonlodge.`)

A safer approach is to write a small script that tokenizes the SQL and only replaces `public.` when it appears as a schema qualifier, not inside strings or comments. But the sed approach works for most migrations if you review the output.

### Storage Policies Are Shared

Storage RLS policies on `storage.objects` apply globally across all tenants. When creating storage policies:
- **Prefix policy names with `CL:`** to identify them as Carleton Lodge policies
- **Scope policies to specific bucket IDs** (e.g., `bucket_id = 'summons-uploads'`)
- **Reference `carletonlodge.is_admin()`** or `carletonlodge.profiles` (not `public.`)
- **Check for conflicts** with existing policies from other tenants before creating

Example:
```sql
CREATE POLICY "CL: Admins can delete summons files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'summons-uploads' AND carletonlodge.is_admin());
```

### Auth Triggers Are Shared

The `auth.users` table is shared across all tenants. Carleton Lodge uses a multi-tenant-aware trigger:

```sql
-- This trigger ONLY creates profiles for users whose email matches a lodge member
CREATE TRIGGER on_auth_user_created_carletonlodge
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION carletonlodge.handle_new_user_if_lodge_member();
```

**Do NOT create triggers on `auth.users` that would fire for all signups.** Always use conditional logic that checks lodge membership first.

---

## Edge Functions

### Deployment

Edge functions deploy normally using `--project-ref`:

```bash
supabase functions deploy <function-name> --project-ref qbflbzgfbmipibvizvcj
```

### Schema Configuration

Any edge function that creates a Supabase client to access Carleton Lodge data MUST include the schema config:

```typescript
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'carletonlodge' }
});
```

Without this, the function would query the `public` schema (which has no Carleton Lodge data) and return empty results or errors.

### Carleton Lodge Edge Functions on Shared A

| Function | Purpose |
|----------|---------|
| `send-summons-notification` | Emails members when new summons are posted |
| `parse-summons` | Extracts content from uploaded summons PDFs |
| `places-autocomplete` | Proxies Google Places API (requires `GOOGLE_PLACES_API_KEY` secret) |
| `manage-member-login` | Creates/resets member login credentials and flags temporary passwords |

### Naming Conflicts

Other tenants also have edge functions deployed to Shared A. If you need to create a new function whose name conflicts with an existing one, prefix yours with `cl-` (e.g., `cl-contact-form`).

**Do NOT overwrite, modify, or delete any of these functions (they belong to other tenants):**

- `contact-form` (stepbystep tenant)
- `newsletter-subscribe` (stepbystep tenant)
- `send-quote-notification` (astrawebdev tenant)
- `awd-contact-form` (astrawebdev tenant)
- `forward-email` (astrawebdev tenant)
- `generate-portfolio-content` (astrawebdev tenant)
- `regenerate-screenshot` (astrawebdev tenant)
- `update-portfolio-item` (astrawebdev tenant)
- `schedule-blog-generation` (astrawebdev tenant)
- `notify-google-indexing` (astrawebdev tenant)
- `upload-preview` (astrawebdev tenant)
- `cleanup-previews` (astrawebdev tenant)
- `generate-keywords` (astrawebdev tenant)
- `refresh-blog-content` (astrawebdev tenant)

---

## Current Database Schema

### Tables (carletonlodge schema)

- `profiles` — User profiles, linked to auth.users by id
- `events` — Lodge events and meetings
- `summons` — Monthly summons (meeting notices with PDF attachments)
- `lodge_members` — Member roster (email-based; links to profiles when members sign up)
- `lodge_positions` — Officer positions and role assignments
- `member_profiles` — Extended member profile data
- `document_categories` — Library document categories
- `documents` — Uploaded lodge documents
- `history_entries` — Lodge history content
- `history_eras` — Historical eras/periods
- `history_milestones` — Key historical milestones
- `photo_albums` — Photo gallery albums
- `photos` — Individual photos within albums
- `contact_submissions` — Public contact form submissions
- `notification_preferences` — Per-user notification settings

### Functions (carletonlodge schema)

- `is_admin()` — Returns true if current authenticated user is a lodge admin
- `handle_new_user_if_lodge_member()` — Auth trigger: creates profile only if email matches lodge_members
- `handle_new_profile_notifications()` — Creates notification_preferences row on profile insert
- `record_current_user_login()` — Stores app-level login timestamps on profiles
- `get_admin_user_last_signins()` — Returns last sign-in timestamps for admin users
- `update_updated_at_column()` — Generic BEFORE UPDATE trigger for updated_at columns
- `update_photo_albums_updated_at()` — Photo albums timestamp trigger
- `update_photos_updated_at()` — Photos timestamp trigger
- `effective_photo_visibility()` — Determines photo visibility based on album settings

### Storage Buckets (shared across tenants, scoped by RLS policies)

| Bucket | Public | Purpose |
|--------|--------|---------|
| `summons-uploads` | No | Summons PDF files (private, requires auth) |
| `lodge-documents` | No | Library documents (private, requires auth) |
| `lodge-photos` | Yes | Photo gallery images (public read) |

RLS policies on these buckets are prefixed with `CL:` and reference `carletonlodge.profiles` / `carletonlodge.is_admin()`.

---

## Environment Variables

The app's `.env` should contain:

```
VITE_SUPABASE_URL=https://qbflbzgfbmipibvizvcj.supabase.co
VITE_SUPABASE_ANON_KEY=<shared A anon key>
```

Vercel environment variables are already configured for Shared A.

---

## Auth Configuration

- **Site URL:** `http://localhost:3000` (shared default fallback for all tenants)
- **Redirect URLs:** All four tenant domains plus localhost variants are in the allowed list
- The app should always pass an explicit `redirectTo` parameter in auth calls pointing to the production domain (`https://concept.carpmasons.com`)
- Auth user ID for the primary admin (ratelle.ja@gmail.com): `85905c99-3832-41aa-b1d0-fd6cee0ac2ed`

---

## Common Pitfalls — Do Not Do These

1. **`supabase db push`** — Will fail or attempt to apply the full schema history, corrupting the shared project.
2. **`supabase db reset`** — Will destroy ALL four tenants' data.
3. **`supabase migration up`** — Will fail due to diverged migration history.
4. **Unscoped `auth.users` triggers** — Will fire for signups from all four sites.
5. **`public.` schema references in applied SQL** — Data lives in `carletonlodge`, not `public`.
6. **Deleting or modifying other tenants' edge functions** — Check the list above.
7. **Storage policies without `CL:` prefix** — Makes it impossible to identify which tenant owns which policy.
8. **Creating storage buckets with generic names** — Other tenants share the bucket namespace. Use descriptive, tenant-scoped names.

---

## Quick Reference

```bash
# Deploy an edge function to Shared A
supabase functions deploy my-function --project-ref qbflbzgfbmipibvizvcj

# Set an edge function secret on Shared A
supabase secrets set MY_KEY=value --project-ref qbflbzgfbmipibvizvcj

# Apply a migration (AFTER schema rewrite from public -> carletonlodge)
supabase db execute --project-ref qbflbzgfbmipibvizvcj < /tmp/migration_rewritten.sql

# NEVER DO THESE:
# supabase db push              ← WILL FAIL OR CORRUPT SHARED PROJECT
# supabase db reset             ← WILL DESTROY ALL FOUR TENANTS
# supabase migration up         ← WILL FAIL (diverged history)
```
