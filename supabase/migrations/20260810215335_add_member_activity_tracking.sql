/*
  # Add protected member activity tracking

  Keeps account activity separate from profiles so roster managers do not
  receive it implicitly. Browser roles cannot query this table; the
  member-activity Edge Function authenticates callers, enforces the dedicated
  read permission, and returns a deliberately small response.
*/

ALTER TABLE public.admin_section_permissions
  DROP CONSTRAINT IF EXISTS admin_section_permissions_section_check;

ALTER TABLE public.admin_section_permissions
  ADD CONSTRAINT admin_section_permissions_section_check CHECK (
    section = ANY (ARRAY[
      'members',
      'events',
      'summons',
      'library',
      'history',
      'gallery',
      'contact',
      'communications',
      'activity'
    ])
  );

ALTER TABLE public.admin_section_permissions
  DROP CONSTRAINT IF EXISTS admin_section_permissions_activity_read_only;

ALTER TABLE public.admin_section_permissions
  ADD CONSTRAINT admin_section_permissions_activity_read_only CHECK (
    section <> 'activity'
    OR (can_read = true AND can_write = false AND can_approve = false)
  );

CREATE TABLE public.member_activity (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.member_activity IS
  'Latest authenticated website activity only; no route, device, or IP history is retained.';
COMMENT ON COLUMN public.member_activity.last_seen_at IS
  'Server-recorded time of the most recent authenticated website heartbeat.';

ALTER TABLE public.member_activity ENABLE ROW LEVEL SECURITY;

-- This table is intentionally not part of the browser Data API surface.
-- The Edge Function uses the service role only after authenticating the caller.
REVOKE ALL ON TABLE public.member_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.member_activity TO service_role;

-- Preserve the best app-owned activity signal collected by the old feature.
INSERT INTO public.member_activity (
  profile_id,
  last_seen_at,
  created_at,
  updated_at
)
SELECT
  id,
  last_sign_in_at,
  COALESCE(created_at, now()),
  now()
FROM public.profiles
WHERE last_sign_in_at IS NOT NULL
ON CONFLICT (profile_id) DO UPDATE
SET
  last_seen_at = GREATEST(
    public.member_activity.last_seen_at,
    EXCLUDED.last_seen_at
  ),
  updated_at = now();

-- Supabase Auth remains the source of truth for actual sign-ins. Removing this
-- profile column prevents member-roster readers from seeing activity metadata.
DROP FUNCTION IF EXISTS public.record_current_user_login();

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS last_sign_in_at;
