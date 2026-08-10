/*
  # Carleton Lodge security hardening

  - Removes anonymous direct writes and enforces least-privilege grants.
  - Adds durable, atomic rate limiting for public and authenticated Edge Functions.
  - Makes gallery storage private and aligns object access with album/photo visibility.
  - Adds server-side upload limits and MIME allowlists.
  - Moves elevated trigger functions out of the Data API schema.
  - Removes execute access from functions that should only run as triggers.
*/

-- Public form submissions must pass through the validated, rate-limited
-- submit-contact Edge Function. Direct Data API inserts are intentionally removed.
DROP POLICY IF EXISTS "Anyone can submit a contact form"
  ON carletonlodge.contact_submissions;
DROP POLICY IF EXISTS "Authenticated users can submit a contact form"
  ON carletonlodge.contact_submissions;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA carletonlodge FROM anon;
GRANT SELECT ON
  carletonlodge.events,
  carletonlodge.history_entries,
  carletonlodge.history_eras,
  carletonlodge.history_milestones,
  carletonlodge.lodge_positions,
  carletonlodge.photo_albums,
  carletonlodge.photos
TO anon;

-- Constrain contact data even when it is inserted by a privileged backend.
ALTER TABLE carletonlodge.contact_submissions
  DROP CONSTRAINT IF EXISTS contact_submissions_name_length,
  DROP CONSTRAINT IF EXISTS contact_submissions_email_length,
  DROP CONSTRAINT IF EXISTS contact_submissions_subject_length,
  DROP CONSTRAINT IF EXISTS contact_submissions_message_length;

ALTER TABLE carletonlodge.contact_submissions
  ADD CONSTRAINT contact_submissions_name_length
    CHECK (length(btrim(name)) BETWEEN 2 AND 120),
  ADD CONSTRAINT contact_submissions_email_length
    CHECK (length(btrim(email)) BETWEEN 3 AND 254),
  ADD CONSTRAINT contact_submissions_subject_length
    CHECK (subject IS NULL OR length(btrim(subject)) BETWEEN 1 AND 100),
  ADD CONSTRAINT contact_submissions_message_length
    CHECK (length(btrim(message)) BETWEEN 10 AND 5000);

-- The table is not exposed to browser roles. Edge Functions use the service role
-- only after completing their own authentication/validation.
CREATE TABLE IF NOT EXISTS carletonlodge.api_rate_limits (
  scope text NOT NULL,
  identifier_hash text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (scope, identifier_hash),
  CONSTRAINT api_rate_limits_scope_format
    CHECK (scope ~ '^[a-z0-9][a-z0-9:_-]{0,63}$'),
  CONSTRAINT api_rate_limits_identifier_hash_format
    CHECK (identifier_hash ~ '^[0-9a-f]{64}$')
);

ALTER TABLE carletonlodge.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON carletonlodge.api_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON carletonlodge.api_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION carletonlodge.consume_api_rate_limit(
  target_scope text,
  target_identifier_hash text,
  maximum_requests integer,
  window_seconds integer
)
RETURNS TABLE (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, carletonlodge
AS $$
DECLARE
  current_time timestamptz := clock_timestamp();
  current_count integer;
  current_window timestamptz;
BEGIN
  IF target_scope !~ '^[a-z0-9][a-z0-9:_-]{0,63}$'
    OR target_identifier_hash !~ '^[0-9a-f]{64}$'
    OR maximum_requests < 1 OR maximum_requests > 10000
    OR window_seconds < 1 OR window_seconds > 86400
  THEN
    RAISE EXCEPTION 'Invalid rate-limit parameters';
  END IF;

  INSERT INTO carletonlodge.api_rate_limits AS limits (
    scope,
    identifier_hash,
    window_started_at,
    request_count,
    updated_at
  )
  VALUES (
    target_scope,
    target_identifier_hash,
    current_time,
    1,
    current_time
  )
  ON CONFLICT (scope, identifier_hash) DO UPDATE
  SET
    window_started_at = CASE
      WHEN limits.window_started_at <= current_time - make_interval(secs => window_seconds)
        THEN current_time
      ELSE limits.window_started_at
    END,
    request_count = CASE
      WHEN limits.window_started_at <= current_time - make_interval(secs => window_seconds)
        THEN 1
      ELSE limits.request_count + 1
    END,
    updated_at = current_time
  RETURNING request_count, window_started_at
  INTO current_count, current_window;

  RETURN QUERY SELECT
    current_count <= maximum_requests,
    GREATEST(maximum_requests - current_count, 0),
    CASE
      WHEN current_count <= maximum_requests THEN 0
      ELSE GREATEST(
        CEIL(EXTRACT(EPOCH FROM (
          current_window + make_interval(secs => window_seconds) - current_time
        )))::integer,
        1
      )
    END;
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge.consume_api_rate_limit(text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION carletonlodge.consume_api_rate_limit(text, text, integer, integer)
  TO service_role;

CREATE INDEX IF NOT EXISTS api_rate_limits_updated_at_idx
  ON carletonlodge.api_rate_limits(updated_at);

-- Keep object paths efficiently resolvable from storage policies.
CREATE INDEX IF NOT EXISTS photos_storage_path_idx
  ON carletonlodge.photos(storage_path);
CREATE INDEX IF NOT EXISTS photo_albums_cover_image_path_idx
  ON carletonlodge.photo_albums(cover_image_path)
  WHERE cover_image_path IS NOT NULL;

-- A public bucket bypasses storage RLS. Make it private, then grant access only
-- when the object belongs to a photo/cover the current viewer may see.
UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 12582912,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]::text[]
WHERE id = 'lodge-photos';

DROP POLICY IF EXISTS "CL: Anyone can view lodge photos" ON storage.objects;
DROP POLICY IF EXISTS "CL: Authenticated users can view lodge photos" ON storage.objects;
DROP POLICY IF EXISTS "CL: Public can view public lodge photos" ON storage.objects;
DROP POLICY IF EXISTS "CL: Members can view permitted lodge photos" ON storage.objects;

CREATE POLICY "CL: Public can view public lodge photos"
  ON storage.objects FOR SELECT
  TO anon
  USING (
    bucket_id = 'lodge-photos'
    AND (
      EXISTS (
        SELECT 1
        FROM carletonlodge.photos photo
        JOIN carletonlodge.photo_albums album ON album.id = photo.album_id
        WHERE photo.storage_path = storage.objects.name
          AND carletonlodge.effective_photo_visibility(
            photo.visibility,
            album.visibility
          ) = 'public'
      )
      OR EXISTS (
        SELECT 1
        FROM carletonlodge.photo_albums album
        WHERE album.cover_image_path = storage.objects.name
          AND album.visibility = 'public'
      )
    )
  );

CREATE POLICY "CL: Members can view permitted lodge photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'lodge-photos'
    AND (
      EXISTS (
        SELECT 1
        FROM carletonlodge.photos photo
        JOIN carletonlodge.photo_albums album ON album.id = photo.album_id
        WHERE photo.storage_path = storage.objects.name
          AND (
            carletonlodge.effective_photo_visibility(
              photo.visibility,
              album.visibility
            ) IN ('public', 'members')
            OR carletonlodge.has_admin_section_permission('gallery', 'read')
          )
      )
      OR EXISTS (
        SELECT 1
        FROM carletonlodge.photo_albums album
        WHERE album.cover_image_path = storage.objects.name
          AND (
            album.visibility IN ('public', 'members')
            OR carletonlodge.has_admin_section_permission('gallery', 'read')
          )
      )
    )
  );

-- Enforce upload controls at Storage, not only in browser inputs.
UPDATE storage.buckets
SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf']::text[]
WHERE id = 'summons-uploads';

UPDATE storage.buckets
SET
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY[
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf'
  ]::text[]
WHERE id = 'lodge-documents';

-- Event assets are deliberately public because they are embedded in the public
-- calendar. Only event editors can upload/update/delete objects in this bucket.
UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 15728640,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]::text[]
WHERE id = 'event-assets';

DROP POLICY IF EXISTS "CL: Anyone can view event assets" ON storage.objects;
CREATE POLICY "CL: Anyone can view event assets"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'event-assets');

UPDATE storage.buckets
SET
  file_size_limit = 12582912,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]::text[]
WHERE id = 'lodge-images';

-- Trigger functions with elevated privileges belong in a non-exposed schema.
CREATE SCHEMA IF NOT EXISTS carletonlodge_private;
REVOKE ALL ON SCHEMA carletonlodge_private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION carletonlodge_private.handle_new_profile_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, carletonlodge
AS $$
BEGIN
  INSERT INTO carletonlodge.notification_preferences (
    id,
    email_notifications,
    notify_new_summons,
    notify_new_events
  )
  VALUES (NEW.id, false, true, true)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION carletonlodge_private.handle_new_user_if_lodge_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, carletonlodge
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM carletonlodge.lodge_members
    WHERE lower(email) = lower(NEW.email)
  ) THEN
    INSERT INTO carletonlodge.profiles (id, email, is_admin, created_at)
    VALUES (NEW.id, NEW.email, false, now())
    ON CONFLICT (id) DO NOTHING;

    UPDATE carletonlodge.lodge_members
    SET linked_profile_id = NEW.id
    WHERE lower(email) = lower(NEW.email)
      AND linked_profile_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION carletonlodge_private.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, carletonlodge
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR carletonlodge.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    RAISE EXCEPTION 'Not permitted to modify is_admin';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Not permitted to modify email';
  END IF;

  IF NEW.force_password_change IS DISTINCT FROM OLD.force_password_change THEN
    RAISE EXCEPTION 'Not permitted to modify force_password_change';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge_private.handle_new_profile_notifications()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION carletonlodge_private.handle_new_user_if_lodge_member()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION carletonlodge_private.protect_profile_privileged_columns()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_profile_created ON carletonlodge.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON carletonlodge.profiles
  FOR EACH ROW
  EXECUTE FUNCTION carletonlodge_private.handle_new_profile_notifications();

DROP TRIGGER IF EXISTS protect_profile_privileged_columns
  ON carletonlodge.profiles;
CREATE TRIGGER protect_profile_privileged_columns
  BEFORE UPDATE ON carletonlodge.profiles
  FOR EACH ROW
  EXECUTE FUNCTION carletonlodge_private.protect_profile_privileged_columns();

DROP TRIGGER IF EXISTS on_auth_user_created_carletonlodge ON auth.users;
CREATE TRIGGER on_auth_user_created_carletonlodge
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION carletonlodge_private.handle_new_user_if_lodge_member();

DROP FUNCTION IF EXISTS carletonlodge.handle_new_profile_notifications();
DROP FUNCTION IF EXISTS carletonlodge.handle_new_user_if_lodge_member();
DROP FUNCTION IF EXISTS carletonlodge.protect_profile_privileged_columns();
DROP FUNCTION IF EXISTS carletonlodge.handle_new_user();

-- RLS helper functions are intentionally callable by authenticated users only.
REVOKE ALL ON FUNCTION carletonlodge.is_admin()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION carletonlodge.is_admin() TO authenticated;

REVOKE ALL ON FUNCTION carletonlodge.get_admin_user_last_signins()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION carletonlodge.get_admin_user_last_signins()
  TO authenticated;

REVOKE ALL ON FUNCTION carletonlodge.record_current_user_login()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION carletonlodge.record_current_user_login()
  TO authenticated;

REVOKE ALL ON FUNCTION carletonlodge.has_admin_section_permission(text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION carletonlodge.has_admin_section_permission(text, text)
  TO authenticated;
