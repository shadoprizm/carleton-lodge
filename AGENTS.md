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
│   ├── Hero.tsx
│   ├── History.tsx
│   ├── MembersDirectory.tsx
│   ├── Navigation.tsx
│   ├── NotificationSettings.tsx
│   ├── PlacesAutocomplete.tsx
│   └── Summons.tsx
├── contexts/            # React contexts
│   └── AuthContext.tsx  # Authentication state management
├── lib/                 # Core libraries
│   └── supabase.ts      # Supabase client and TypeScript types
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
│   ├── CalendarPage.tsx
│   ├── GalleryPage.tsx
│   ├── HistoryPage.tsx
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

static/                  # Static assets (images, files)
public/                  # Public assets
```

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

Currently, the project does not have automated tests configured. When adding tests:
- Use Vitest (consistent with Vite ecosystem)
- Test utilities in `src/utils/`
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

## Useful Notes

- The summons PDF parsing uses a custom Edge Function that extracts text from PDF files using regex-based parsing (handles both text-based and some compressed PDFs)
- Member visibility can be controlled per-member via `visible_to_members` flag
- Photo albums and photos have visibility levels: 'public', 'members', or 'admin'
- The lodge logo is stored in `static/Screenshot_2026-03-01_at_08.13.26.png`
- History entries support deep linking via `/history/:slug` routes
