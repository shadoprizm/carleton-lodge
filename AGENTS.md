# Carleton Lodge 465 Website

This is the official website for **Carleton Lodge 465**, a Masonic Lodge located in Carp, West Ottawa. The lodge was founded on January 4, 1904.

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3 with custom fonts (Playfair Display for headings, Inter for body)
- **UI Animation**: Framer Motion
- **Icons**: Lucide React
- **Routing**: React Router DOM v7

### Backend
- **Platform**: Supabase
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage (for images, documents, and summons PDFs)
- **Edge Functions**: Deno-based serverless functions

## Project Structure

```
src/
├── components/           # React components
│   ├── admin/           # Admin panel components
│   │   ├── MembersManager.tsx
│   │   └── SummonsManager.tsx
│   ├── AuthModal.tsx
│   ├── Calendar.tsx
│   ├── Contact.tsx
│   ├── ContactForm.tsx
│   ├── DocumentPreviewModal.tsx
│   ├── EventModal.tsx
│   ├── Events.tsx
│   ├── Footer.tsx             # Site-wide footer (mounted once in App.tsx after <main>)
│   ├── Hero.tsx
│   ├── History.tsx          # Homepage history teaser (static chapter data)
│   ├── MembersDirectory.tsx
│   ├── Navigation.tsx
│   ├── NotificationSettings.tsx
│   ├── PageMetadata.tsx     # Per-route <title>/meta management
│   ├── PlacesAutocomplete.tsx
│   └── Summons.tsx
│   ├── history/             # Public history archive building blocks
│   │   ├── HistoryLayout.tsx  # Breadcrumb + chapter sub-nav wrapper for /history/*
│   │   ├── Timeline.tsx, HistoryFigure.tsx, Lightbox.tsx, SourceNotes.tsx,
│   │   └── ChapterCard.tsx, PersonCard.tsx, PlaceCard.tsx, ArtifactCard.tsx
├── contexts/            # React contexts
│   └── AuthContext.tsx  # Authentication state management
├── lib/                 # Core libraries
│   ├── supabase.ts      # Supabase client and TypeScript types
│   └── history/         # Static curated history archive data (+ historyData.test.ts)
│                        #   types, sources, events, chapters, people, places,
│                        #   artifacts, images, openQuestions, index (barrel)
├── pages/               # Page components
│   ├── admin/           # Admin pages
│   │   ├── AdminLayout.tsx
│   │   ├── AdminUsersPage.tsx
│   │   ├── AdminMembersPage.tsx
│   │   ├── AdminEventsPage.tsx
│   │   ├── AdminSummonsPage.tsx
│   │   ├── AdminHistoryPage.tsx
│   │   ├── AdminLibraryPage.tsx
│   │   ├── AdminGalleryPage.tsx
│   │   └── AdminContactPage.tsx
│   ├── history/         # Public history archive (lazy-loaded): HistoryLandingPage,
│   │                    #   FoundingPage, FireAndDisplacementPage, TemplePage,
│   │                    #   LeHavrePage, WarAndRemembrancePage, PeoplePage,
│   │                    #   HistoryGalleryPage, HistorySourcesPage
│   ├── CalendarPage.tsx
│   ├── GalleryPage.tsx
│   ├── HomePage.tsx
│   ├── LibraryPage.tsx
│   ├── MembersPage.tsx
│   ├── PrivacyPolicyPage.tsx
│   ├── SummonsPage.tsx
│   └── TermsAndConditionsPage.tsx
├── utils/               # Utility functions
│   └── imageProcessor.ts # Client-side image resizing/compression
├── App.tsx              # Root application component
├── main.tsx             # Application entry point
└── index.css            # Global styles with Tailwind

supabase/
├── functions/           # Edge Functions (Deno runtime)
│   ├── parse-summons/   # PDF parsing for summons documents
│   └── send-summons-notification/  # Email notifications
└── migrations/          # Database migrations (chronological order)

static/                  # Static assets served at the site root (vite.config.ts sets publicDir: 'static')
│   └── history/         # History archive assets: legacy/ display copies of recovered Lodge photos
public/                  # NOT served by Vite — holds the legacy photo preservation store
│   └── history/archive/legacy-owned/  # Recovered Lodge photos (originals/ + manifest: never modify or reference)
k3-handoff/              # Source research package behind the history archive data
```

### Public history archive

`/history` and its chapter sub-routes (`/history/founding`, `/history/fire-and-displacement`, `/history/temple`, `/history/le-havre`, `/history/war-and-remembrance`, `/history/people`, `/history/gallery`, `/history/sources`) render static, source-grounded data from `src/lib/history/` — they do **not** read from Supabase. Legacy slugs redirect: `/history/formative-era-1904-1920` → `/history/founding`, `/history/great-fire-1920` → `/history/fire-and-displacement`, `/history/international-connection-1916-1930` → `/history/le-havre`, `/history/architectural-heritage-1872-1925` → `/history/temple`, `/history/modern-era-2000-2026` → `/history`. The Supabase `history_entries` table and `AdminHistoryPage` remain unchanged for admin editing. Image slots without rights-cleared assets are **not displayed publicly at all** — their metadata (rightsStatus, acquisition notes, open questions in `openQuestions.ts`) stays in `src/lib/history/` as the internal curation record but must never render. Public copy must avoid curation/workflow language; `historyData.test.ts` enforces this for rendered fields. Recovered Lodge-owned legacy photos are registered as `LEG01`–`LEG14` (source S10); AI reconstructions are confined to the clearly labelled "AI reconstructions" gallery filter.

## Database Schema

### Core Tables
- **`events`** - Calendar events with location, date/time, and point of contact
- **`history_entries`** - Lodge history timeline with year, content, and images
- **`profiles`** - User profiles with `is_admin` flag for role-based access
- **`member_profiles`** - Extended member information (phone, address, bio, visibility)
- **`lodge_positions`** - Officer positions (Worshipful Master, Secretary, etc.)
- **`lodge_members`** - Official roster with optional link to user profiles
- **`summons`** - Monthly summons documents with PDF storage
- **`notification_preferences`** - Per-user email notification settings
- **`document_categories`** & **`documents`** - Categorized document library
- **`photo_albums`** & **`photos`** - Photo gallery with visibility controls
- **`contact_submissions`** - Contact form submissions

### Security
All tables have Row Level Security (RLS) enabled with policies for:
- Public read access to history, public gallery photos
- Authenticated user access to member-only content
- Admin-only write access to sensitive data
- Users can only modify their own notification preferences

## Build and Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run ESLint
npm run lint

# Run TypeScript type checking
npm run typecheck

# Run unit tests (Vitest)
npm test
```

## Environment Variables

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Note**: Variables must be prefixed with `VITE_` to be accessible in the browser.

## Key Features

### Authentication & Authorization
- Email/password authentication via Supabase Auth
- Admin role managed via `profiles.is_admin` column
- Protected routes for member-only and admin-only content

### Admin Panel (`/admin`)
- User management
- Member roster management
- Events calendar management
- Summons upload and parsing (PDF to text extraction)
- Document library management
- History timeline editing
- Photo gallery management
- Contact form submissions

### Member Features
- View calendar of events
- Access summons documents
- Member directory (with privacy controls)
- Document library access
- Photo gallery (public and members-only albums)
- Notification preferences (email alerts for new summons/events)

### Public Features
- Lodge history timeline
- Public photo gallery
- Contact form
- Information about the lodge

## Code Style Guidelines

### TypeScript
- Strict mode enabled (`strict: true`)
- All components use `.tsx` extension
- Types defined in `src/lib/supabase.ts` for database entities
- Props interfaces defined inline or in component files

### React
- Functional components with hooks
- Context API for global state (AuthContext)
- React Router for navigation
- Framer Motion for animations

### Styling
- Tailwind CSS utility classes
- Custom color scheme: slate-900 (dark navy), amber-600/amber-400 (gold accents)
- Typography: Playfair Display for headings (serif), Inter for body (sans-serif)
- Mobile-first responsive design

### Component Patterns
- Components export named functions
- Props interfaces defined at top of file
- Form state managed with `useState`
- Supabase queries use async/await with error handling

## Testing Strategy

Vitest is available (`npm test`, zero-config — the Vite config is picked up automatically). The main data-integrity suite is `src/lib/history/historyData.test.ts` (10 tests), which validates the static history archive's data integrity: source/image ID references, unique chapter slugs, valid image types, no AI reconstruction under "Historical photographs", and every `localPath` resolving to a real file in `static/`. Component-level suites also exist colocated with their components (e.g. `src/components/PageMetadata.test.tsx`, `src/components/Footer.test.tsx`) using `@testing-library/react` with `MemoryRouter`. When adding tests:
- Use Vitest (consistent with Vite ecosystem)
- Colocate `*.test.ts` next to pure logic in `src/lib/` / `src/utils/`
- Integration tests for Supabase queries

## Security Considerations

1. **RLS Policies**: All database tables have Row Level Security enabled
2. **Admin Verification**: Admin routes check `is_admin` flag from AuthContext
3. **File Uploads**: Images are processed client-side before upload (resized to max 1920x1080, converted to WebP)
4. **Environment Variables**: Supabase keys are exposed to browser (anon key only), service role key never exposed
5. **CORS**: Edge Functions include CORS headers for cross-origin requests

## Deployment

### Frontend
- Built output goes to `dist/` directory
- Can be deployed to any static hosting (Netlify, Vercel, etc.)
- Configure environment variables in hosting platform

### Supabase
- Database migrations in `supabase/migrations/` (run via Supabase CLI)
- Edge Functions deployed via `supabase functions deploy`
- Storage buckets created via migrations

### Production baseline
- `main` is the only production source branch. Never deploy a feature branch or a dirty worktree to the production domain.
- Every production change must pass `.github/workflows/verify.yml` (type-check, unit tests, lint, and production build) on a pull request before merge.
- Preview and verify the Vercel deployment before merging. After merge, verify the production deployment and the member-only routes affected by the change.
- The dedicated Supabase project is `isnxsygngysxgzeuhmjm`; application tables use the `public` schema. The former shared project `qbflbzgfbmipibvizvcj` is rollback/archive infrastructure only and must not receive new application deployments.
- Keep database migrations and Edge Function source in the same pull request as the frontend that depends on them. Deploy backend dependencies before promoting the frontend.

## Useful Notes

- The summons PDF parsing uses a custom Edge Function that extracts text from PDF files using regex-based parsing (handles both text-based and some compressed PDFs)
- Member visibility can be controlled per-member via `visible_to_members` flag
- Photo albums and photos have visibility levels: 'public', 'members', or 'admin'
- The lodge logo is stored in `static/Screenshot_2026-03-01_at_08.13.26.png`
- The public history archive lives under `/history` with chapter sub-routes; legacy era slugs redirect (see "Public history archive" above)
