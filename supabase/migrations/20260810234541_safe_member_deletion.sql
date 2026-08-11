/*
  # Safe member deletion and immediate session revocation

  Member deletion spans Postgres, Supabase Auth, and MXroute. A durable,
  server-only job retains the target Auth user ID if an external deletion
  attempt fails after the roster link has been removed. RLS also verifies that
  the JWT's session still exists so a deleted user's unexpired access token
  cannot continue reading member-only records or storage objects.
*/

CREATE TABLE public.member_deletion_jobs (
  member_id uuid PRIMARY KEY
    REFERENCES public.lodge_members(id) ON DELETE CASCADE,
  auth_user_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'auth_delete_failed', 'auth_deleted')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX member_deletion_jobs_auth_user_idx
  ON public.member_deletion_jobs(auth_user_id)
  WHERE auth_user_id IS NOT NULL;
CREATE INDEX member_deletion_jobs_requested_by_idx
  ON public.member_deletion_jobs(requested_by)
  WHERE requested_by IS NOT NULL;

CREATE TRIGGER update_member_deletion_jobs_updated_at
  BEFORE UPDATE ON public.member_deletion_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.member_deletion_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.member_deletion_jobs
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.member_deletion_jobs
  TO service_role;

COMMENT ON TABLE public.member_deletion_jobs IS
  'Server-only retry state for multi-system member deletion.';

CREATE OR REPLACE FUNCTION private.has_active_session()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.sessions AS active_session
    WHERE active_session.id::text = (SELECT auth.jwt() ->> 'session_id')
      AND active_session.user_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION private.has_active_session()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_active_session()
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.revoke_member_sessions(target_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO pg_catalog, auth
AS $$
DECLARE
  revoked_count bigint;
BEGIN
  DELETE FROM auth.sessions
  WHERE user_id = target_user_id;

  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  RETURN revoked_count;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_member_sessions(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_member_sessions(uuid)
  TO service_role;

COMMENT ON FUNCTION public.revoke_member_sessions(uuid) IS
  'Server-only immediate session revocation used during member deletion.';

CREATE OR REPLACE FUNCTION private.current_lodge_member_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
  SELECT member.id
  FROM public.lodge_members AS member
  WHERE private.has_active_session()
    AND member.linked_profile_id = (SELECT auth.uid())
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
  SELECT private.has_active_session()
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.id = (SELECT auth.uid())
        AND profile.is_admin = true
    );
$$;

CREATE OR REPLACE FUNCTION private.has_admin_section_permission(
  target_section text,
  access_level text DEFAULT 'read'
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL OR NOT private.has_active_session() THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = current_user_id
      AND is_admin = true
  ) THEN
    RETURN true;
  END IF;

  IF access_level = 'approve' THEN
    RETURN target_section = 'events' AND EXISTS (
      SELECT 1
      FROM public.admin_section_permissions
      WHERE profile_id = current_user_id
        AND section = target_section
        AND can_approve = true
    );
  END IF;

  IF access_level = 'write' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.admin_section_permissions
      WHERE profile_id = current_user_id
        AND section = target_section
        AND can_write = true
    );
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.admin_section_permissions
    WHERE profile_id = current_user_id
      AND section = target_section
      AND (can_read = true OR can_write = true OR can_approve = true)
  );
END;
$$;

-- Member-only table reads must reject a signed-out or deleted session even if
-- its access token has not reached its exp claim yet.
DROP POLICY IF EXISTS "Members and communications readers can view announcements"
  ON public.announcements;
CREATE POLICY "Members and communications readers can view announcements"
  ON public.announcements FOR SELECT TO authenticated
  USING (
    private.has_active_session()
    AND (
      (
        is_published = true
        AND visibility IN ('public', 'members')
        AND (expires_at IS NULL OR expires_at > now())
      )
      OR private.has_admin_section_permission('communications', 'read')
    )
  );

DROP POLICY IF EXISTS "Members can view District 1 events"
  ON public.district_events;
CREATE POLICY "Members can view District 1 events"
  ON public.district_events FOR SELECT TO authenticated
  USING (private.has_active_session());

DROP POLICY IF EXISTS "Members can view District 1 lodges"
  ON public.district_lodges;
CREATE POLICY "Members can view District 1 lodges"
  ON public.district_lodges FOR SELECT TO authenticated
  USING (private.has_active_session());

DROP POLICY IF EXISTS "Members can view District 1 summons"
  ON public.district_summons;
CREATE POLICY "Members can view District 1 summons"
  ON public.district_summons FOR SELECT TO authenticated
  USING (private.has_active_session());

DROP POLICY IF EXISTS "Authenticated members can view categories"
  ON public.document_categories;
CREATE POLICY "Authenticated members can view categories"
  ON public.document_categories FOR SELECT TO authenticated
  USING (private.has_active_session());

DROP POLICY IF EXISTS "Authenticated members can view documents"
  ON public.documents;
CREATE POLICY "Authenticated members can view documents"
  ON public.documents FOR SELECT TO authenticated
  USING (private.has_active_session());

DROP POLICY IF EXISTS "Members can view published email policies"
  ON public.email_policy_versions;
CREATE POLICY "Members can view published email policies"
  ON public.email_policy_versions FOR SELECT TO authenticated
  USING (
    private.has_active_session()
    AND (
      is_active
      OR private.has_admin_section_permission('members', 'read')
    )
  );

DROP POLICY IF EXISTS "Members and event managers can view events"
  ON public.events;
CREATE POLICY "Members and event managers can view events"
  ON public.events FOR SELECT TO authenticated
  USING (
    private.has_active_session()
    AND (
      visibility IN ('public', 'members')
      OR private.has_admin_section_permission('events', 'read')
    )
  );

DROP POLICY IF EXISTS "Members can view help topics"
  ON public.help_topics;
CREATE POLICY "Members can view help topics"
  ON public.help_topics FOR SELECT TO authenticated
  USING (
    private.has_active_session()
    AND visibility IN ('public', 'members')
  );

DROP POLICY IF EXISTS "Members and administrators can search lodge knowledge"
  ON public.lodge_knowledge;
CREATE POLICY "Members and administrators can search lodge knowledge"
  ON public.lodge_knowledge FOR SELECT TO authenticated
  USING (
    private.has_active_session()
    AND (
      (
        visibility IN ('public', 'members')
        AND (valid_until IS NULL OR valid_until > now())
      )
      OR private.is_admin()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can view lodge members"
  ON public.lodge_members;
CREATE POLICY "Authenticated users can view lodge members"
  ON public.lodge_members FOR SELECT TO authenticated
  USING (
    private.has_active_session()
    AND (visible_to_members = true OR private.is_admin())
  );

DROP POLICY IF EXISTS "Members can view member profiles"
  ON public.member_profiles;
CREATE POLICY "Members can view member profiles"
  ON public.member_profiles FOR SELECT TO authenticated
  USING (
    private.has_active_session()
    AND (
      id = (SELECT auth.uid())
      OR visible_to_members = true
      OR private.is_admin()
    )
  );

DROP POLICY IF EXISTS "Members can view public and member albums"
  ON public.photo_albums;
CREATE POLICY "Members can view public and member albums"
  ON public.photo_albums FOR SELECT TO authenticated
  USING (
    private.has_active_session()
    AND (
      visibility IN ('public', 'members')
      OR (visibility = 'admin' AND private.is_admin())
    )
  );

DROP POLICY IF EXISTS "Members can view photos based on visibility"
  ON public.photos;
CREATE POLICY "Members can view photos based on visibility"
  ON public.photos FOR SELECT TO authenticated
  USING (
    private.has_active_session()
    AND (
      public.effective_photo_visibility(
        visibility,
        (SELECT album.visibility
         FROM public.photo_albums AS album
         WHERE album.id = photos.album_id)
      ) IN ('public', 'members')
      OR (
        public.effective_photo_visibility(
          visibility,
          (SELECT album.visibility
           FROM public.photo_albums AS album
           WHERE album.id = photos.album_id)
        ) = 'admin'
        AND private.is_admin()
      )
    )
  );

DROP POLICY IF EXISTS "Authenticated users can view summons"
  ON public.summons;
CREATE POLICY "Authenticated users can view summons"
  ON public.summons FOR SELECT TO authenticated
  USING (private.has_active_session());

-- Storage objects need the same session check because Storage evaluates its
-- own policies independently from the metadata tables above.
DROP POLICY IF EXISTS "Authenticated can read documents" ON storage.objects;
CREATE POLICY "Authenticated can read documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'lodge-documents'
    AND private.has_active_session()
  );

DROP POLICY IF EXISTS "Authenticated can read summons uploads"
  ON storage.objects;
CREATE POLICY "Authenticated can read summons uploads"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'summons-uploads'
    AND private.has_active_session()
  );

-- This older policy delegates visibility back through photo table RLS. The
-- explicit public/member policies below already cover the same objects and
-- make the session requirement auditable in one place.
DROP POLICY IF EXISTS "Lodge photos follow row visibility"
  ON storage.objects;

DROP POLICY IF EXISTS "CL: Members can view permitted lodge photos"
  ON storage.objects;
CREATE POLICY "CL: Members can view permitted lodge photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'lodge-photos'
    AND private.has_active_session()
    AND (
      EXISTS (
        SELECT 1
        FROM public.photos AS photo
        JOIN public.photo_albums AS album ON album.id = photo.album_id
        WHERE photo.storage_path = storage.objects.name
          AND (
            public.effective_photo_visibility(
              photo.visibility,
              album.visibility
            ) IN ('public', 'members')
            OR private.has_admin_section_permission('gallery', 'read')
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.photo_albums AS album
        WHERE album.cover_image_path = storage.objects.name
          AND (
            album.visibility IN ('public', 'members')
            OR private.has_admin_section_permission('gallery', 'read')
          )
      )
    )
  );

-- Event assets are public to read, but only an active session may mutate an
-- authenticated user's upload folder.
DROP POLICY IF EXISTS "Event assets upload owner or editor"
  ON storage.objects;
CREATE POLICY "Event assets upload owner or editor"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    private.has_active_session()
    AND bucket_id = 'event-assets'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR private.has_admin_section_permission('events', 'write')
    )
  );

DROP POLICY IF EXISTS "Event assets update owner or editor"
  ON storage.objects;
CREATE POLICY "Event assets update owner or editor"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    private.has_active_session()
    AND bucket_id = 'event-assets'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR private.has_admin_section_permission('events', 'write')
    )
  )
  WITH CHECK (
    private.has_active_session()
    AND bucket_id = 'event-assets'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR private.has_admin_section_permission('events', 'write')
    )
  );

DROP POLICY IF EXISTS "Event assets delete owner or editor"
  ON storage.objects;
CREATE POLICY "Event assets delete owner or editor"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    private.has_active_session()
    AND bucket_id = 'event-assets'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR private.has_admin_section_permission('events', 'write')
    )
  );
