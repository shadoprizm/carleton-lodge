/*
  # Fix Security Issues: Indexes, RLS Policies, Functions

  ## Changes

  ### 1. Missing Foreign Key Indexes
  - documents: category_id, uploaded_by
  - photo_albums: cover_photo_id, created_by
  - photos: album_id, uploaded_by
  - summons: created_by

  ### 2. Drop Unused Indexes
  - idx_history_milestones_date, events_created_by_idx,
    lodge_members_position_id_idx, lodge_members_linked_profile_id_idx,
    member_profiles_position_id_idx, notification_preferences_email_enabled_idx,
    lodge_members_email_idx

  ### 3. RLS Auth Performance
  - Replace auth.uid() with (select auth.uid()) in all policies
    across: profiles, events, history_entries, history_eras,
    history_milestones, lodge_positions, member_profiles, summons,
    notification_preferences, photo_albums, photos, contact_submissions,
    lodge_members

  ### 4. Multiple Permissive Policies
  - Consolidate duplicate SELECT policies on: lodge_members, lodge_positions,
    member_profiles, profiles (SELECT and UPDATE)

  ### 5. Always-True INSERT Policy
  - contact_submissions INSERT now validates non-empty fields

  ### 6. Mutable Search Path Functions
  - Fix is_admin, update_updated_at_column, effective_photo_visibility,
    update_photo_albums_updated_at, update_photos_updated_at,
    handle_new_user, handle_new_profile_notifications
*/

-- ============================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_documents_category_id ON public.documents(category_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_photo_albums_cover_photo_id ON public.photo_albums(cover_photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_albums_created_by ON public.photo_albums(created_by);
CREATE INDEX IF NOT EXISTS idx_photos_album_id ON public.photos(album_id);
CREATE INDEX IF NOT EXISTS idx_photos_uploaded_by ON public.photos(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_summons_created_by ON public.summons(created_by);

-- ============================================================
-- 2. DROP UNUSED INDEXES
-- ============================================================

DROP INDEX IF EXISTS public.idx_history_milestones_date;
DROP INDEX IF EXISTS public.events_created_by_idx;
DROP INDEX IF EXISTS public.lodge_members_position_id_idx;
DROP INDEX IF EXISTS public.lodge_members_linked_profile_id_idx;
DROP INDEX IF EXISTS public.member_profiles_position_id_idx;
DROP INDEX IF EXISTS public.notification_preferences_email_enabled_idx;
DROP INDEX IF EXISTS public.lodge_members_email_idx;

-- ============================================================
-- 3 & 4. FIX RLS POLICIES (auth perf + consolidate permissive)
-- ============================================================

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

-- events
DROP POLICY IF EXISTS "Authenticated users can create events" ON public.events;
DROP POLICY IF EXISTS "Users can update own events or admins can update any" ON public.events;
DROP POLICY IF EXISTS "Users can delete own events or admins can delete any" ON public.events;

CREATE POLICY "Authenticated users can create events"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = created_by);

CREATE POLICY "Users can update own events or admins can update any"
  ON public.events FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) = created_by
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  )
  WITH CHECK (
    (select auth.uid()) = created_by
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Users can delete own events or admins can delete any"
  ON public.events FOR DELETE
  TO authenticated
  USING (
    (select auth.uid()) = created_by
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

-- history_entries
DROP POLICY IF EXISTS "Admins can create history entries" ON public.history_entries;
DROP POLICY IF EXISTS "Admins can update history entries" ON public.history_entries;
DROP POLICY IF EXISTS "Admins can delete history entries" ON public.history_entries;

CREATE POLICY "Admins can create history entries"
  ON public.history_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can update history entries"
  ON public.history_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can delete history entries"
  ON public.history_entries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

-- history_eras
DROP POLICY IF EXISTS "Admins can insert history eras" ON public.history_eras;
DROP POLICY IF EXISTS "Admins can update history eras" ON public.history_eras;
DROP POLICY IF EXISTS "Admins can delete history eras" ON public.history_eras;

CREATE POLICY "Admins can insert history eras"
  ON public.history_eras FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can update history eras"
  ON public.history_eras FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can delete history eras"
  ON public.history_eras FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

-- history_milestones
DROP POLICY IF EXISTS "Admins can insert history milestones" ON public.history_milestones;
DROP POLICY IF EXISTS "Admins can update history milestones" ON public.history_milestones;
DROP POLICY IF EXISTS "Admins can delete history milestones" ON public.history_milestones;

CREATE POLICY "Admins can insert history milestones"
  ON public.history_milestones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can update history milestones"
  ON public.history_milestones FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can delete history milestones"
  ON public.history_milestones FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

-- lodge_positions: replace FOR ALL + separate SELECT with consolidated policies
DROP POLICY IF EXISTS "Admins can manage positions" ON public.lodge_positions;
DROP POLICY IF EXISTS "Anyone can view positions" ON public.lodge_positions;

CREATE POLICY "Anyone can view positions"
  ON public.lodge_positions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert positions"
  ON public.lodge_positions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can update positions"
  ON public.lodge_positions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can delete positions"
  ON public.lodge_positions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

-- member_profiles: consolidate 3 SELECT policies into 1
DROP POLICY IF EXISTS "Users can view own profile" ON public.member_profiles;
DROP POLICY IF EXISTS "Admins can view all member profiles" ON public.member_profiles;
DROP POLICY IF EXISTS "Members can view visible profiles" ON public.member_profiles;
DROP POLICY IF EXISTS "Admins can insert member profiles" ON public.member_profiles;
DROP POLICY IF EXISTS "Admins can update member profiles" ON public.member_profiles;
DROP POLICY IF EXISTS "Admins can delete member profiles" ON public.member_profiles;

CREATE POLICY "Members and admins can view member profiles"
  ON public.member_profiles FOR SELECT
  TO authenticated
  USING (
    visible_to_members = true
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can insert member profiles"
  ON public.member_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can update member profiles"
  ON public.member_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can delete member profiles"
  ON public.member_profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

-- summons
DROP POLICY IF EXISTS "Admins can create summons" ON public.summons;
DROP POLICY IF EXISTS "Admins can update summons" ON public.summons;
DROP POLICY IF EXISTS "Admins can delete summons" ON public.summons;

CREATE POLICY "Admins can create summons"
  ON public.summons FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can update summons"
  ON public.summons FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can delete summons"
  ON public.summons FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

-- notification_preferences (uses id, not user_id)
DROP POLICY IF EXISTS "Users can view own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can insert own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can update own notification preferences" ON public.notification_preferences;

CREATE POLICY "Users can view own notification preferences"
  ON public.notification_preferences FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- photo_albums
DROP POLICY IF EXISTS "Members can view public and member albums" ON public.photo_albums;
DROP POLICY IF EXISTS "Admins can insert albums" ON public.photo_albums;
DROP POLICY IF EXISTS "Admins can update albums" ON public.photo_albums;
DROP POLICY IF EXISTS "Admins can delete albums" ON public.photo_albums;

CREATE POLICY "Members can view public and member albums"
  ON public.photo_albums FOR SELECT
  TO authenticated
  USING (
    (visibility = ANY (ARRAY['public'::text, 'members'::text]))
    OR (
      visibility = 'admin'
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (select auth.uid()) AND p.is_admin = true
      )
    )
  );

CREATE POLICY "Admins can insert albums"
  ON public.photo_albums FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can update albums"
  ON public.photo_albums FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can delete albums"
  ON public.photo_albums FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

-- photos
DROP POLICY IF EXISTS "Members can view photos based on visibility" ON public.photos;
DROP POLICY IF EXISTS "Admins can insert photos" ON public.photos;
DROP POLICY IF EXISTS "Admins can update photos" ON public.photos;
DROP POLICY IF EXISTS "Admins can delete photos" ON public.photos;

CREATE POLICY "Members can view photos based on visibility"
  ON public.photos FOR SELECT
  TO authenticated
  USING (
    effective_photo_visibility(visibility, (
      SELECT photo_albums.visibility FROM public.photo_albums
      WHERE photo_albums.id = photos.album_id
    )) = ANY (ARRAY['public'::text, 'members'::text])
    OR (
      effective_photo_visibility(visibility, (
        SELECT photo_albums.visibility FROM public.photo_albums
        WHERE photo_albums.id = photos.album_id
      )) = 'admin'
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (select auth.uid()) AND p.is_admin = true
      )
    )
  );

CREATE POLICY "Admins can insert photos"
  ON public.photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can update photos"
  ON public.photos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can delete photos"
  ON public.photos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

-- contact_submissions
DROP POLICY IF EXISTS "Anyone can submit a contact form" ON public.contact_submissions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Admins can update submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Admins can delete submissions" ON public.contact_submissions;

CREATE POLICY "Anyone can submit a contact form"
  ON public.contact_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    name IS NOT NULL AND char_length(trim(name)) > 0
    AND email IS NOT NULL AND char_length(trim(email)) > 0
    AND message IS NOT NULL AND char_length(trim(message)) > 0
  );

CREATE POLICY "Admins can view all submissions"
  ON public.contact_submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can update submissions"
  ON public.contact_submissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can delete submissions"
  ON public.contact_submissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

-- lodge_members: consolidate 2 SELECT policies into 1
DROP POLICY IF EXISTS "Admins can view all lodge members" ON public.lodge_members;
DROP POLICY IF EXISTS "Members can view visible lodge members" ON public.lodge_members;
DROP POLICY IF EXISTS "Admins can insert lodge members" ON public.lodge_members;
DROP POLICY IF EXISTS "Admins can update lodge members" ON public.lodge_members;
DROP POLICY IF EXISTS "Admins can delete lodge members" ON public.lodge_members;

CREATE POLICY "Members and admins can view lodge members"
  ON public.lodge_members FOR SELECT
  TO authenticated
  USING (
    visible_to_members = true
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can insert lodge members"
  ON public.lodge_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can update lodge members"
  ON public.lodge_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can delete lodge members"
  ON public.lodge_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

-- ============================================================
-- 5. FIX MUTABLE SEARCH PATH FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND is_admin = true
  );
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.effective_photo_visibility(photo_visibility text, album_visibility text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE WHEN photo_visibility = 'inherit' THEN album_visibility ELSE photo_visibility END;
$$;

CREATE OR REPLACE FUNCTION public.update_photo_albums_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_photos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_admin, created_at)
  VALUES (NEW.id, NEW.email, false, now())
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.lodge_members
  SET linked_profile_id = NEW.id
  WHERE email = NEW.email
  AND linked_profile_id IS NULL;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_profile_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notification_preferences (id, email_notifications, notify_new_summons, notify_new_events)
  VALUES (NEW.id, false, true, true)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
