-- Consolidate the new authenticated SELECT policies so PostgreSQL evaluates a
-- single permission expression per table, and cover existing foreign keys the
-- performance advisor identified in the Carleton Lodge schema.

DROP POLICY IF EXISTS "Members can view lodge events" ON carletonlodge.events;
DROP POLICY IF EXISTS "Event managers can view all events" ON carletonlodge.events;
CREATE POLICY "Members and event managers can view events"
  ON carletonlodge.events FOR SELECT TO authenticated
  USING (
    visibility IN ('public', 'members')
    OR carletonlodge.has_admin_section_permission('events', 'read')
  );

DROP POLICY IF EXISTS "Members can view active announcements" ON carletonlodge.announcements;
DROP POLICY IF EXISTS "Communications readers can view all announcements" ON carletonlodge.announcements;
CREATE POLICY "Members and communications readers can view announcements"
  ON carletonlodge.announcements FOR SELECT TO authenticated
  USING (
    (
      is_published = true
      AND visibility IN ('public', 'members')
      AND (expires_at IS NULL OR expires_at > now())
    )
    OR carletonlodge.has_admin_section_permission('communications', 'read')
  );

DROP POLICY IF EXISTS "Members can search lodge knowledge" ON carletonlodge.lodge_knowledge;
DROP POLICY IF EXISTS "Full administrators can search administrative knowledge" ON carletonlodge.lodge_knowledge;
CREATE POLICY "Members and administrators can search lodge knowledge"
  ON carletonlodge.lodge_knowledge FOR SELECT TO authenticated
  USING (
    (
      visibility IN ('public', 'members')
      AND (valid_until IS NULL OR valid_until > now())
    )
    OR carletonlodge.is_admin()
  );

CREATE INDEX IF NOT EXISTS admin_section_permissions_granted_by_idx
  ON carletonlodge.admin_section_permissions(granted_by);
CREATE INDEX IF NOT EXISTS announcements_created_by_idx
  ON carletonlodge.announcements(created_by);
CREATE INDEX IF NOT EXISTS documents_category_id_idx
  ON carletonlodge.documents(category_id);
CREATE INDEX IF NOT EXISTS history_milestones_era_id_idx
  ON carletonlodge.history_milestones(era_id);
CREATE INDEX IF NOT EXISTS lodge_members_linked_profile_id_idx
  ON carletonlodge.lodge_members(linked_profile_id);
CREATE INDEX IF NOT EXISTS lodge_members_position_id_idx
  ON carletonlodge.lodge_members(position_id);
CREATE INDEX IF NOT EXISTS member_profiles_position_id_idx
  ON carletonlodge.member_profiles(position_id);
CREATE INDEX IF NOT EXISTS photos_album_id_idx
  ON carletonlodge.photos(album_id);
