/*
  # Section-level admin permissions

  Adds delegated admin access for individual site sections. Full admins still
  have implicit access everywhere through profiles.is_admin. Delegated members
  can receive read and/or write access for specific admin sections.
*/

CREATE TABLE IF NOT EXISTS carletonlodge.admin_section_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES carletonlodge.profiles(id) ON DELETE CASCADE,
  section text NOT NULL CHECK (
    section IN ('members', 'events', 'summons', 'library', 'history', 'gallery', 'contact')
  ),
  can_read boolean NOT NULL DEFAULT true,
  can_write boolean NOT NULL DEFAULT false,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_section_permissions_unique_profile_section UNIQUE (profile_id, section),
  CONSTRAINT admin_section_permissions_has_access CHECK (can_read = true OR can_write = true)
);

ALTER TABLE carletonlodge.admin_section_permissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS admin_section_permissions_profile_id_idx
  ON carletonlodge.admin_section_permissions(profile_id);

DROP TRIGGER IF EXISTS update_admin_section_permissions_updated_at
  ON carletonlodge.admin_section_permissions;
CREATE TRIGGER update_admin_section_permissions_updated_at
  BEFORE UPDATE ON carletonlodge.admin_section_permissions
  FOR EACH ROW EXECUTE FUNCTION carletonlodge.update_updated_at_column();

CREATE OR REPLACE FUNCTION carletonlodge.has_admin_section_permission(
  target_section text,
  access_level text DEFAULT 'read'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = carletonlodge
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM carletonlodge.profiles
    WHERE id = current_user_id
      AND is_admin = true
  ) THEN
    RETURN true;
  END IF;

  IF access_level = 'write' THEN
    RETURN EXISTS (
      SELECT 1
      FROM carletonlodge.admin_section_permissions
      WHERE profile_id = current_user_id
        AND section = target_section
        AND can_write = true
    );
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM carletonlodge.admin_section_permissions
    WHERE profile_id = current_user_id
      AND section = target_section
      AND (can_read = true OR can_write = true)
  );
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge.has_admin_section_permission(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION carletonlodge.has_admin_section_permission(text, text) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON carletonlodge.admin_section_permissions TO authenticated;

DROP POLICY IF EXISTS "Users can view own section permissions" ON carletonlodge.admin_section_permissions;
DROP POLICY IF EXISTS "Admins can view all section permissions" ON carletonlodge.admin_section_permissions;
DROP POLICY IF EXISTS "Admins can manage section permissions" ON carletonlodge.admin_section_permissions;

CREATE POLICY "Users can view own section permissions"
  ON carletonlodge.admin_section_permissions FOR SELECT
  TO authenticated
  USING (profile_id = (SELECT auth.uid()));

CREATE POLICY "Admins can view all section permissions"
  ON carletonlodge.admin_section_permissions FOR SELECT
  TO authenticated
  USING (carletonlodge.is_admin());

CREATE POLICY "Admins can manage section permissions"
  ON carletonlodge.admin_section_permissions FOR ALL
  TO authenticated
  USING (carletonlodge.is_admin())
  WITH CHECK (carletonlodge.is_admin());

-- Profiles: member managers need account emails for roster linking.
DROP POLICY IF EXISTS "Member managers can view profiles" ON carletonlodge.profiles;
CREATE POLICY "Member managers can view profiles"
  ON carletonlodge.profiles FOR SELECT
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('members', 'read'));

-- Events: replace broad authenticated-user writes with section write access.
DROP POLICY IF EXISTS "Authenticated users can create events" ON carletonlodge.events;
DROP POLICY IF EXISTS "Users can update their own events" ON carletonlodge.events;
DROP POLICY IF EXISTS "Users can delete their own events" ON carletonlodge.events;
DROP POLICY IF EXISTS "Users can update own events or admins can update any" ON carletonlodge.events;
DROP POLICY IF EXISTS "Users can delete own events or admins can delete any" ON carletonlodge.events;
DROP POLICY IF EXISTS "Event editors can create events" ON carletonlodge.events;
DROP POLICY IF EXISTS "Event editors can update events" ON carletonlodge.events;
DROP POLICY IF EXISTS "Event editors can delete events" ON carletonlodge.events;

CREATE POLICY "Event editors can create events"
  ON carletonlodge.events FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND carletonlodge.has_admin_section_permission('events', 'write')
  );

CREATE POLICY "Event editors can update events"
  ON carletonlodge.events FOR UPDATE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('events', 'write'))
  WITH CHECK (carletonlodge.has_admin_section_permission('events', 'write'));

CREATE POLICY "Event editors can delete events"
  ON carletonlodge.events FOR DELETE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('events', 'write'));

-- Members and positions.
DROP POLICY IF EXISTS "Member managers can view all lodge members" ON carletonlodge.lodge_members;
DROP POLICY IF EXISTS "Member managers can insert lodge members" ON carletonlodge.lodge_members;
DROP POLICY IF EXISTS "Member managers can update lodge members" ON carletonlodge.lodge_members;
DROP POLICY IF EXISTS "Member managers can delete lodge members" ON carletonlodge.lodge_members;

CREATE POLICY "Member managers can view all lodge members"
  ON carletonlodge.lodge_members FOR SELECT
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('members', 'read'));

CREATE POLICY "Member managers can insert lodge members"
  ON carletonlodge.lodge_members FOR INSERT
  TO authenticated
  WITH CHECK (carletonlodge.has_admin_section_permission('members', 'write'));

CREATE POLICY "Member managers can update lodge members"
  ON carletonlodge.lodge_members FOR UPDATE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('members', 'write'))
  WITH CHECK (carletonlodge.has_admin_section_permission('members', 'write'));

CREATE POLICY "Member managers can delete lodge members"
  ON carletonlodge.lodge_members FOR DELETE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('members', 'write'));

DROP POLICY IF EXISTS "Member managers can manage positions" ON carletonlodge.lodge_positions;
CREATE POLICY "Member managers can manage positions"
  ON carletonlodge.lodge_positions FOR ALL
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('members', 'write'))
  WITH CHECK (carletonlodge.has_admin_section_permission('members', 'write'));

DROP POLICY IF EXISTS "Member managers can view all member profiles" ON carletonlodge.member_profiles;
DROP POLICY IF EXISTS "Member managers can insert member profiles" ON carletonlodge.member_profiles;
DROP POLICY IF EXISTS "Member managers can update member profiles" ON carletonlodge.member_profiles;
DROP POLICY IF EXISTS "Member managers can delete member profiles" ON carletonlodge.member_profiles;

CREATE POLICY "Member managers can view all member profiles"
  ON carletonlodge.member_profiles FOR SELECT
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('members', 'read'));

CREATE POLICY "Member managers can insert member profiles"
  ON carletonlodge.member_profiles FOR INSERT
  TO authenticated
  WITH CHECK (carletonlodge.has_admin_section_permission('members', 'write'));

CREATE POLICY "Member managers can update member profiles"
  ON carletonlodge.member_profiles FOR UPDATE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('members', 'write'))
  WITH CHECK (carletonlodge.has_admin_section_permission('members', 'write'));

CREATE POLICY "Member managers can delete member profiles"
  ON carletonlodge.member_profiles FOR DELETE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('members', 'write'));

-- Summons.
DROP POLICY IF EXISTS "Summons editors can create summons" ON carletonlodge.summons;
DROP POLICY IF EXISTS "Summons editors can update summons" ON carletonlodge.summons;
DROP POLICY IF EXISTS "Summons editors can delete summons" ON carletonlodge.summons;

CREATE POLICY "Summons editors can create summons"
  ON carletonlodge.summons FOR INSERT
  TO authenticated
  WITH CHECK (carletonlodge.has_admin_section_permission('summons', 'write'));

CREATE POLICY "Summons editors can update summons"
  ON carletonlodge.summons FOR UPDATE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('summons', 'write'))
  WITH CHECK (carletonlodge.has_admin_section_permission('summons', 'write'));

CREATE POLICY "Summons editors can delete summons"
  ON carletonlodge.summons FOR DELETE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('summons', 'write'));

-- Library.
DROP POLICY IF EXISTS "Library editors can insert categories" ON carletonlodge.document_categories;
DROP POLICY IF EXISTS "Library editors can update categories" ON carletonlodge.document_categories;
DROP POLICY IF EXISTS "Library editors can delete categories" ON carletonlodge.document_categories;
DROP POLICY IF EXISTS "Library editors can insert documents" ON carletonlodge.documents;
DROP POLICY IF EXISTS "Library editors can update documents" ON carletonlodge.documents;
DROP POLICY IF EXISTS "Library editors can delete documents" ON carletonlodge.documents;
DROP POLICY IF EXISTS "Summons editors can archive summons documents" ON carletonlodge.documents;

CREATE POLICY "Library editors can insert categories"
  ON carletonlodge.document_categories FOR INSERT
  TO authenticated
  WITH CHECK (carletonlodge.has_admin_section_permission('library', 'write'));

CREATE POLICY "Library editors can update categories"
  ON carletonlodge.document_categories FOR UPDATE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('library', 'write'))
  WITH CHECK (carletonlodge.has_admin_section_permission('library', 'write'));

CREATE POLICY "Library editors can delete categories"
  ON carletonlodge.document_categories FOR DELETE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('library', 'write'));

CREATE POLICY "Library editors can insert documents"
  ON carletonlodge.documents FOR INSERT
  TO authenticated
  WITH CHECK (carletonlodge.has_admin_section_permission('library', 'write'));

CREATE POLICY "Library editors can update documents"
  ON carletonlodge.documents FOR UPDATE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('library', 'write'))
  WITH CHECK (carletonlodge.has_admin_section_permission('library', 'write'));

CREATE POLICY "Library editors can delete documents"
  ON carletonlodge.documents FOR DELETE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('library', 'write'));

CREATE POLICY "Summons editors can archive summons documents"
  ON carletonlodge.documents FOR INSERT
  TO authenticated
  WITH CHECK (
    carletonlodge.has_admin_section_permission('summons', 'write')
    AND storage_bucket = 'summons-uploads'
  );

-- History.
DROP POLICY IF EXISTS "History editors can create history entries" ON carletonlodge.history_entries;
DROP POLICY IF EXISTS "History editors can update history entries" ON carletonlodge.history_entries;
DROP POLICY IF EXISTS "History editors can delete history entries" ON carletonlodge.history_entries;
DROP POLICY IF EXISTS "History editors can insert history eras" ON carletonlodge.history_eras;
DROP POLICY IF EXISTS "History editors can update history eras" ON carletonlodge.history_eras;
DROP POLICY IF EXISTS "History editors can delete history eras" ON carletonlodge.history_eras;
DROP POLICY IF EXISTS "History editors can insert history milestones" ON carletonlodge.history_milestones;
DROP POLICY IF EXISTS "History editors can update history milestones" ON carletonlodge.history_milestones;
DROP POLICY IF EXISTS "History editors can delete history milestones" ON carletonlodge.history_milestones;

CREATE POLICY "History editors can create history entries"
  ON carletonlodge.history_entries FOR INSERT
  TO authenticated
  WITH CHECK (carletonlodge.has_admin_section_permission('history', 'write'));

CREATE POLICY "History editors can update history entries"
  ON carletonlodge.history_entries FOR UPDATE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('history', 'write'))
  WITH CHECK (carletonlodge.has_admin_section_permission('history', 'write'));

CREATE POLICY "History editors can delete history entries"
  ON carletonlodge.history_entries FOR DELETE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('history', 'write'));

CREATE POLICY "History editors can insert history eras"
  ON carletonlodge.history_eras FOR INSERT
  TO authenticated
  WITH CHECK (carletonlodge.has_admin_section_permission('history', 'write'));

CREATE POLICY "History editors can update history eras"
  ON carletonlodge.history_eras FOR UPDATE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('history', 'write'))
  WITH CHECK (carletonlodge.has_admin_section_permission('history', 'write'));

CREATE POLICY "History editors can delete history eras"
  ON carletonlodge.history_eras FOR DELETE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('history', 'write'));

CREATE POLICY "History editors can insert history milestones"
  ON carletonlodge.history_milestones FOR INSERT
  TO authenticated
  WITH CHECK (carletonlodge.has_admin_section_permission('history', 'write'));

CREATE POLICY "History editors can update history milestones"
  ON carletonlodge.history_milestones FOR UPDATE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('history', 'write'))
  WITH CHECK (carletonlodge.has_admin_section_permission('history', 'write'));

CREATE POLICY "History editors can delete history milestones"
  ON carletonlodge.history_milestones FOR DELETE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('history', 'write'));

-- Gallery.
DROP POLICY IF EXISTS "Gallery readers can view all albums" ON carletonlodge.photo_albums;
DROP POLICY IF EXISTS "Gallery editors can insert albums" ON carletonlodge.photo_albums;
DROP POLICY IF EXISTS "Gallery editors can update albums" ON carletonlodge.photo_albums;
DROP POLICY IF EXISTS "Gallery editors can delete albums" ON carletonlodge.photo_albums;
DROP POLICY IF EXISTS "Gallery readers can view all photos" ON carletonlodge.photos;
DROP POLICY IF EXISTS "Gallery editors can insert photos" ON carletonlodge.photos;
DROP POLICY IF EXISTS "Gallery editors can update photos" ON carletonlodge.photos;
DROP POLICY IF EXISTS "Gallery editors can delete photos" ON carletonlodge.photos;

CREATE POLICY "Gallery readers can view all albums"
  ON carletonlodge.photo_albums FOR SELECT
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('gallery', 'read'));

CREATE POLICY "Gallery editors can insert albums"
  ON carletonlodge.photo_albums FOR INSERT
  TO authenticated
  WITH CHECK (carletonlodge.has_admin_section_permission('gallery', 'write'));

CREATE POLICY "Gallery editors can update albums"
  ON carletonlodge.photo_albums FOR UPDATE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('gallery', 'write'))
  WITH CHECK (carletonlodge.has_admin_section_permission('gallery', 'write'));

CREATE POLICY "Gallery editors can delete albums"
  ON carletonlodge.photo_albums FOR DELETE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('gallery', 'write'));

CREATE POLICY "Gallery readers can view all photos"
  ON carletonlodge.photos FOR SELECT
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('gallery', 'read'));

CREATE POLICY "Gallery editors can insert photos"
  ON carletonlodge.photos FOR INSERT
  TO authenticated
  WITH CHECK (carletonlodge.has_admin_section_permission('gallery', 'write'));

CREATE POLICY "Gallery editors can update photos"
  ON carletonlodge.photos FOR UPDATE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('gallery', 'write'))
  WITH CHECK (carletonlodge.has_admin_section_permission('gallery', 'write'));

CREATE POLICY "Gallery editors can delete photos"
  ON carletonlodge.photos FOR DELETE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('gallery', 'write'));

-- Contact.
DROP POLICY IF EXISTS "Contact readers can view submissions" ON carletonlodge.contact_submissions;
DROP POLICY IF EXISTS "Contact editors can update submissions" ON carletonlodge.contact_submissions;
DROP POLICY IF EXISTS "Contact editors can delete submissions" ON carletonlodge.contact_submissions;

CREATE POLICY "Contact readers can view submissions"
  ON carletonlodge.contact_submissions FOR SELECT
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('contact', 'read'));

CREATE POLICY "Contact editors can update submissions"
  ON carletonlodge.contact_submissions FOR UPDATE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('contact', 'write'))
  WITH CHECK (carletonlodge.has_admin_section_permission('contact', 'write'));

CREATE POLICY "Contact editors can delete submissions"
  ON carletonlodge.contact_submissions FOR DELETE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('contact', 'write'));

-- Storage policies for delegated writers.
DROP POLICY IF EXISTS "CL: Summons editors can upload summons files" ON storage.objects;
DROP POLICY IF EXISTS "CL: Summons editors can delete summons files" ON storage.objects;
DROP POLICY IF EXISTS "CL: Library editors can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "CL: Library editors can update documents" ON storage.objects;
DROP POLICY IF EXISTS "CL: Library editors can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "CL: Gallery editors can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "CL: Gallery editors can update photos" ON storage.objects;
DROP POLICY IF EXISTS "CL: Gallery editors can delete photos" ON storage.objects;
DROP POLICY IF EXISTS "CL: History editors can upload images" ON storage.objects;
DROP POLICY IF EXISTS "CL: History editors can update images" ON storage.objects;
DROP POLICY IF EXISTS "CL: History editors can delete images" ON storage.objects;
DROP POLICY IF EXISTS "CL: Event editors can upload event assets" ON storage.objects;
DROP POLICY IF EXISTS "CL: Event editors can update event assets" ON storage.objects;
DROP POLICY IF EXISTS "CL: Event editors can delete event assets" ON storage.objects;

CREATE POLICY "CL: Summons editors can upload summons files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'summons-uploads'
    AND carletonlodge.has_admin_section_permission('summons', 'write')
  );

CREATE POLICY "CL: Summons editors can delete summons files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'summons-uploads'
    AND carletonlodge.has_admin_section_permission('summons', 'write')
  );

CREATE POLICY "CL: Library editors can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lodge-documents'
    AND carletonlodge.has_admin_section_permission('library', 'write')
  );

CREATE POLICY "CL: Library editors can update documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'lodge-documents'
    AND carletonlodge.has_admin_section_permission('library', 'write')
  )
  WITH CHECK (
    bucket_id = 'lodge-documents'
    AND carletonlodge.has_admin_section_permission('library', 'write')
  );

CREATE POLICY "CL: Library editors can delete documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lodge-documents'
    AND carletonlodge.has_admin_section_permission('library', 'write')
  );

CREATE POLICY "CL: Gallery editors can upload photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lodge-photos'
    AND carletonlodge.has_admin_section_permission('gallery', 'write')
  );

CREATE POLICY "CL: Gallery editors can update photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'lodge-photos'
    AND carletonlodge.has_admin_section_permission('gallery', 'write')
  )
  WITH CHECK (
    bucket_id = 'lodge-photos'
    AND carletonlodge.has_admin_section_permission('gallery', 'write')
  );

CREATE POLICY "CL: Gallery editors can delete photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lodge-photos'
    AND carletonlodge.has_admin_section_permission('gallery', 'write')
  );

CREATE POLICY "CL: History editors can upload images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lodge-images'
    AND carletonlodge.has_admin_section_permission('history', 'write')
  );

CREATE POLICY "CL: History editors can update images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'lodge-images'
    AND carletonlodge.has_admin_section_permission('history', 'write')
  )
  WITH CHECK (
    bucket_id = 'lodge-images'
    AND carletonlodge.has_admin_section_permission('history', 'write')
  );

CREATE POLICY "CL: History editors can delete images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lodge-images'
    AND carletonlodge.has_admin_section_permission('history', 'write')
  );

CREATE POLICY "CL: Event editors can upload event assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-assets'
    AND carletonlodge.has_admin_section_permission('events', 'write')
  );

CREATE POLICY "CL: Event editors can update event assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'event-assets'
    AND carletonlodge.has_admin_section_permission('events', 'write')
  )
  WITH CHECK (
    bucket_id = 'event-assets'
    AND carletonlodge.has_admin_section_permission('events', 'write')
  );

CREATE POLICY "CL: Event editors can delete event assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-assets'
    AND carletonlodge.has_admin_section_permission('events', 'write')
  );
