# Carleton Lodge 465 Website

Official website for **Carleton Lodge No. 465**, a Masonic Lodge in Carp, West Ottawa (founded January 4, 1904). Production URL: `concept.carpmasons.com` (deployed on Vercel). It gives members a calendar, summons documents, a document library, a photo gallery, lodge history, a member directory, member mailboxes, and an admin panel.

> **A companion file, `AGENT.md`, contains critical operational rules for the shared multi-tenant Supabase project. Read it before touching anything database- or deployment-related. The key rules are summarized below.**

## Technology Stack

### Frontend
- **Framework**: React 19 with TypeScript (strict mode)
- **Build Tool**: Vite 8 (rolldown-based build; manual chunk groups for `react-vendor`, `supabase-vendor`, `motion-vendor` in `vite.config.ts`)
- **Styling**: Tailwind CSS 3 (utility classes; config is otherwise default) + custom fonts loaded from Google Fonts in `index.html` (Playfair Display for headings, Inter for body, applied in `src/index.css`)
- **Routing**: React Router v8 (`react-router` package — import from `'react-router'`, not `react-router-dom`); all pages are lazy-loaded in `src/App.tsx`
- **UI Animation**: Framer Motion; **Icons**: Lucide React (excluded from `optimizeDeps`)
- **Other**: `react-easy-crop` for album cover cropping

### Backend
- **Platform**: Supabase (PostgreSQL + Auth + Storage + Deno Edge Functions)
- **Schema-based multi-tenancy**: this app does **not** have its own Supabase project. It shares the project **Shared A** (ref `qbflbzgfbmipibvizvcj`) with three other sites. All Carleton Lodge tables live in the PostgreSQL schema **`carletonlodge`**, and the client is created with `db: { schema: 'carletonlodge' }` (`src/lib/supabase.ts`). Table names in app code are unqualified.
- **AI integrations**: OpenAI Responses API is used server-side by Edge Functions (Lodge Guide assistant, Lodge Mailroom drafting). Google Places API is proxied by an Edge Function.

## Project Structure

```
src/
├── components/            # Shared React components
│   ├── admin/             # Admin-building-block components
│   │   ├── AnnouncementsManager.tsx
│   │   ├── LodgeMailroom.tsx
│   │   ├── MembersManager.tsx
│   │   └── SummonsManager.tsx
│   ├── AppErrorBoundary.tsx
│   ├── AuthModal.tsx            # Sign-in/sign-up modal
│   ├── ForcePasswordChangeModal.tsx
│   ├── MemberGate.tsx           # Wraps member-only routes
│   ├── LodgeGuidePilotGate.tsx  # Admin-only gate for the Lodge Guide pilot
│   ├── Navigation.tsx
│   ├── PageMetadata.tsx         # Per-route <title>/meta management
│   ├── RichTextEditor.tsx / RichTextContent.tsx
│   ├── Calendar.tsx, Events.tsx, EventModal.tsx, Hero.tsx,
│   ├── History.tsx            # Homepage history teaser (static chapter data)
│   ├── Summons.tsx, MembersDirectory.tsx, Contact.tsx, ContactForm.tsx,
│   ├── NotificationSettings.tsx, PlacesAutocomplete.tsx,
│   ├── DocumentPreviewModal.tsx, CoverCropModal.tsx, Announcements.tsx
│   ├── history/               # Public history archive building blocks
│   │   ├── HistoryLayout.tsx  # Breadcrumb + chapter sub-nav wrapper for /history/*
│   │   ├── Timeline.tsx, HistoryFigure.tsx, Lightbox.tsx, SourceNotes.tsx,
│   │   └── ChapterCard.tsx, PersonCard.tsx, PlaceCard.tsx, ArtifactCard.tsx
├── contexts/
│   └── AuthContext.tsx    # Session, profile, is_admin, section permissions
├── lib/                   # Core logic + unit tests (*.test.ts)
│   ├── supabase.ts        # Supabase client + ALL database entity types
│   ├── adminPermissions.ts  # Delegated per-section read/write/approve model
│   ├── lodgeGuide.ts      # Lodge Guide feature flag (VITE_ASK_CARLETON_ENABLED)
│   ├── lodgeGuideSearch.ts, mailboxPassword.ts, contact.ts
│   ├── history/           # Static curated history archive data (+ historyData.test.ts)
│   │                      #   types, sources, events, chapters, people, places,
│   │                      #   artifacts, images, openQuestions, index (barrel)
├── pages/                 # Route-level components (all lazy-loaded)
│   ├── admin/             # AdminLayout + Admin{Users,Members,Events,Summons,
│   │                      #   History,Library,Gallery,Contact,Communications}Page
│   ├── history/           # Public history archive: HistoryLandingPage, FoundingPage,
│   │                      #   FireAndDisplacementPage, TemplePage, LeHavrePage,
│   │                      #   WarAndRemembrancePage, PeoplePage, HistoryGalleryPage,
│   │                      #   HistorySourcesPage
│   ├── HomePage, CalendarPage,
│   ├── GalleryPage, SummonsPage, MembersPage, MemberProfilePage,
│   ├── LibraryPage, MyLodgePage, MailboxSetupPage, AskCarletonPage,
│   ├── SearchPage, HelpPage, LinksPage, ResetPasswordPage,
│   ├── PrivacyPolicyPage, TermsAndConditionsPage, NotFoundPage
├── utils/                 # Pure helpers + unit tests
│   ├── assetUrls.ts       # Storage/public asset URL building
│   ├── calendarExport.ts  # ICS export
│   ├── dateTime.ts, imageProcessor.ts, richText.ts
├── test/setup.ts          # Vitest setup (jest-dom)
├── App.tsx                # All routes; MemberGate wraps member-only pages
└── main.tsx

supabase/
├── functions/             # Deno Edge Functions (see table below)
│   └── _shared/           # Shared Deno modules (branded email, http security,
│                          #   lodge-guide search, rate limiting)
└── migrations/            # SQL migrations in chronological order (see "Database changes")

static/                    # Served at site root — vite.config.ts sets publicDir: 'static'
public/                    # NOT served by Vite (publicDir is overridden); legacy images only
docs/                      # Architecture decision records (Lodge Guide, Mailroom,
                           #   calendar approvals/email)
```

### Route model (`src/App.tsx`)
- Public: `/`, `/calendar`, `/gallery`, `/search`, `/help`, `/links`, `/privacy-policy`, `/terms-and-conditions`, `/reset-password`
- Public history archive (static curated data from `src/lib/history/`): `/history` plus `/history/founding`, `/history/fire-and-displacement`, `/history/temple`, `/history/le-havre`, `/history/war-and-remembrance`, `/history/people`, `/history/gallery`, `/history/sources`. Legacy slugs redirect: `/history/formative-era-1904-1920` → `/history/founding`, `/history/great-fire-1920` → `/history/fire-and-displacement`, `/history/international-connection-1916-1930` → `/history/le-havre`, `/history/architectural-heritage-1872-1925` → `/history/temple`, `/history/modern-era-2000-2026` → `/history`.
- Member-only (wrapped in `MemberGate`): `/my-lodge`, `/my-lodge/email`, `/summons`, `/members`, `/members/:memberId`, `/library`
- Lodge Guide pilot: `/lodge-guide` — requires the `VITE_ASK_CARLETON_ENABLED=true` flag **and** an admin user (`LodgeGuidePilotGate`); `/ask-carleton` redirects to it
- Admin: `/admin/*` under `AdminLayout`, which checks `is_admin` plus per-section permissions

> The public history archive is static, source-grounded data (`src/lib/history/`) — it does **not** read from Supabase. The `history_eras`/`history_milestones` tables and `AdminHistoryPage` still exist unchanged: they feed the Lodge Guide knowledge search (via DB trigger) and admin editing. Image slots without rights-cleared assets render the neutral placeholder `static/history/photo-pending.svg`; AI reconstructions are confined to the clearly labelled "AI reconstructions" gallery filter.

## Build and Development Commands

```bash
npm install          # install dependencies
npm run dev          # Vite dev server
npm run build        # production build to dist/
npm run preview      # preview production build
npm run lint         # ESLint (flat config, typescript-eslint + react-hooks)
npm run typecheck    # tsc --noEmit -p tsconfig.app.json
npm test             # Vitest, single run
npm run test:watch   # Vitest watch mode
```

The dev server proxies `/file/*` to Supabase authenticated storage (`/storage/v1/object/authenticated/*`), forwarding the `Authorization` header — this lets the app load private storage objects through same-origin URLs.

## Testing

Vitest is configured (`vitest.config.ts`, `jsdom` environment, setup at `src/test/setup.ts`, `@testing-library/react` + `jest-dom` available). Tests live next to the code as `*.test.ts` in `src/lib/` and `src/utils/` — currently 49 tests across 13 files covering admin permissions, Lodge Guide gating/search, mailbox password rules, contact validation, calendar export, date/time helpers, and history archive data integrity. All pass as of this writing. Match this layout when adding tests: pure logic goes in `lib/`/`utils/` with a colocated test file; there is no end-to-end or Supabase integration test suite.

## Database Schema (all in the `carletonlodge` schema)

Core tables: `events`, `event_submissions`, `history_entries`, `profiles` (`is_admin`, `force_password_change`, `last_sign_in_at`), `member_profiles`, `lodge_positions`, `lodge_members`, `summons`, `announcements`, `notification_preferences`, `notification_outbox`, `document_categories`, `documents`, `photo_albums`, `photos`, `contact_submissions`, `help_topics`, knowledge-search tables, and the Lodge Mailroom set (`inbound_emails`, `trusted_email_senders`, `mailroom_imports`). TypeScript types for all of these are defined in `src/lib/supabase.ts`.

Storage buckets (shared namespace across tenants, RLS-scoped): `summons-uploads` (private), `lodge-documents` (private), `lodge-photos` (public read), `event-assets`.

## Database Changes — Read Carefully

**Never run `supabase db push`, `supabase db reset`, or `supabase migration up`.** The shared project's migration history does not match this repo; these commands will fail or destroy other tenants' data.

Workflow (full details in `AGENT.md`):

1. Write the migration in `supabase/migrations/` for version control.
2. Before applying, rewrite schema references `public.` → `carletonlodge.` — but **never** rewrite `auth.*`, `storage.*`, `extensions.*`, `pg_catalog.*`, `information_schema.*`, or `cron.*`.
3. Apply manually via the Supabase Dashboard SQL editor or `supabase db execute --project-ref qbflbzgfbmipibvizvcj < rewritten.sql`. Always review the rewritten SQL first.
4. Storage RLS policies are global across tenants: prefix names with `CL:` and scope them to specific bucket IDs.
5. Never create unconditional triggers on the shared `auth.users` table; the existing trigger only creates profiles for emails matching `lodge_members`.

## Edge Functions (`supabase/functions/`, Deno)

Deploy with `supabase functions deploy <name> --project-ref qbflbzgfbmipibvizvcj`. Every function that reads lodge data must create its client with `db: { schema: 'carletonlodge' }`. If a new function name collides with another tenant's, prefix it `cl-`.

| Function | Purpose |
|----------|---------|
| `ask-carleton` | Lodge Guide member knowledge assistant (OpenAI Responses API, permission-filtered retrieval; internal slug kept for compatibility) |
| `cl-mailroom` | Lodge Mailroom: turns the Secretary's emailed summons PDF into a human-reviewed draft (summons + events + announcements) |
| `cl-email-webhook` | Inbound email webhook normalizer (Resend now; AgentMail payload tolerated) |
| `cl-process-notifications` | Drains the `notification_outbox` email queue |
| `cl-configure-support-forwarder` | Support-address forwarding setup |
| `activate-member-mailbox`, `manage-member-login`, `change-required-password` | Member mailbox/login lifecycle (temporary passwords, forced change, Pwned Passwords check) |
| `parse-summons` | Regex-based PDF text extraction for summons uploads |
| `send-summons-notification` | Emails members about new summons |
| `places-autocomplete` | Proxies Google Places (needs `GOOGLE_PLACES_API_KEY` secret) |
| `submit-contact` | Public contact form endpoint (honeypot-aware) |

Server-side secrets (e.g. `OPENAI` key, `GOOGLE_PLACES_API_KEY`, `MXROUTE_*`, `LODGE_GUIDE_ACCESS`) live in Edge Function secrets, never in `VITE_` variables.

## Environment Variables

Create `.env` from `.env.example`:

```
VITE_SUPABASE_URL=https://qbflbzgfbmipibvizvcj.supabase.co
VITE_SUPABASE_ANON_KEY=<shared A anon key>
VITE_ASK_CARLETON_ENABLED=false   # true exposes the admin-only Lodge Guide pilot
```

Only `VITE_`-prefixed variables reach the browser; the anon key is safe to expose, the service-role key never is.

## Key Features

- **Auth**: email/password via Supabase Auth; `profiles.is_admin` for full admins; `admin_section_permissions` table gives delegated per-section `read`/`write`/`approve` rights (see `src/lib/adminPermissions.ts`); temporary passwords force a change via `ForcePasswordChangeModal`.
- **Calendar**: members submit events into `event_submissions` (pending); approvers publish them into `events` via a single-transaction trigger (see `docs/calendar-approvals-and-email.md`). Events have visibility (`public`/`members`/`admin`) and status (`scheduled`/`cancelled`/`postponed`).
- **Email**: business code never calls an email API directly — it inserts idempotent jobs into `notification_outbox`, processed by `cl-process-notifications`.
- **Lodge Mailroom**: trusted-sender-verified inbound email → OpenAI-drafted summons/events/announcements → mandatory human review → one publish transaction (`docs/lodge-mailroom-architecture.md`). No webhook, model output, or PDF can publish directly.
- **Lodge Guide** (`/lodge-guide`, pilot): read-only member knowledge assistant with strict citation and abstention rules, gated behind a feature flag, admin gate, and an evaluation checklist (`docs/ask-carleton-architecture.md`, `docs/ask-carleton-evaluation.md`). Never grant it write abilities.
- **Member mailboxes**: members get a lodge email address (MXroute-backed) via `/my-lodge/email`.
- **Uploads**: images are resized/compressed client-side (`src/utils/imageProcessor.ts`, WebP) before upload.

## Code Style Guidelines

- **TypeScript**: strict mode, `noUnusedLocals`/`noUnusedParameters`; `.tsx` for components; database types centralized in `src/lib/supabase.ts`.
- **React**: function components with hooks; named exports; props interfaces at the top of the file; global state only through `AuthContext`; forms use `useState`; Supabase calls use async/await with explicit error handling.
- **Styling**: Tailwind utilities; color scheme slate-900 (dark navy) with amber-600/amber-400 (gold) accents; mobile-first responsive; accessibility touches exist (`skip-link`, ARIA roles) — preserve them.
- **ESLint**: flat config (`eslint.config.js`); the React-Compiler-oriented `react-hooks` rules `immutability`, `refs`, and `set-state-in-effect` are intentionally off.

## Security Considerations

1. RLS is enabled on every table: public read for history/gallery/public events, member-only content for authenticated users, admin-only writes; users edit only their own preferences.
2. The client app enforces gates (`MemberGate`, `AdminLayout`), but authorization is enforced by Postgres — retrieval for AI features is filtered in the database before anything reaches a model.
3. `vercel.json` sets a strict CSP (`default-src 'self'`, Supabase connect/img/media allowlist), HSTS, frame denial, permissions policy, and 404s for dotfiles, lockfiles, configs, and common probe paths; the SPA fallback rewrites everything else to `/index.html`.
4. Auth calls should pass an explicit `redirectTo` to the production domain — the Supabase site URL is a shared fallback.
5. Edge Functions verify webhook signatures, apply rate limits, and treat email/PDF/model content as untrusted input (`store: false` on OpenAI calls).

## Deployment

- **Frontend**: Vercel (config in `vercel.json`, project metadata in `.vercel/`); env vars are configured in the Vercel dashboard. `dist/` is the build output.
- **Supabase**: migrations applied manually per the rewrite rules above; Edge Functions deployed with `--project-ref qbflbzgfbmipibvizvcj`; `deno.lock` pins Edge Function dependencies.
- `static/robots.txt` and `static/sitemap.xml` are served at the site root.

## Useful Notes

- Architecture decisions live in `docs/` — consult them before changing the Lodge Guide, Mailroom, or calendar/email flows.
- The lodge logo is `static/Screenshot_2026-03-01_at_08.13.26.png`; `static/logo-mark.webp` also exists.
- `public/` still contains older images but is **not** part of the Vite build (only `static/` is served). Put new assets in `static/`.
- The public history archive lives under `/history` with chapter sub-routes; legacy era slugs redirect (see the route model above).
- Recovered Lodge-owned legacy photographs (from Wayback captures of carletonlodge465.com) are preserved in `public/history/archive/legacy-owned/` — a preservation store that is **not served** by Vite (`originals/` and the manifest must never be modified or referenced from the site). Display copies live in `static/history/legacy/` and are registered as `LEG01`–`LEG14` in `src/lib/history/images.ts` (source S10).
- Member/photo/event visibility uses the `public` | `members` | `admin` enum throughout.
