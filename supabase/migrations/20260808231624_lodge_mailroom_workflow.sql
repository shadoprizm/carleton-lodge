/*
  # Lodge Mailroom

  Turns authenticated inbound email into an auditable draft. Nothing is
  published until an authorized administrator reviews and approves the draft.
  The workflow is provider-neutral: Resend remains the active provider, while
  AgentMail can use the same normalized inbound_emails table later.
*/

CREATE TABLE IF NOT EXISTS carletonlodge.trusted_email_senders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trusted_email_senders_email_check CHECK (
    email = lower(btrim(email))
    AND length(email) BETWEEN 3 AND 320
    AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  CONSTRAINT trusted_email_senders_label_check CHECK (
    length(btrim(label)) BETWEEN 1 AND 120
  ),
  CONSTRAINT trusted_email_senders_email_unique UNIQUE (email)
);

ALTER TABLE carletonlodge.trusted_email_senders ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS trusted_email_senders_active_idx
  ON carletonlodge.trusted_email_senders(is_active, email);

DROP TRIGGER IF EXISTS update_trusted_email_senders_updated_at
  ON carletonlodge.trusted_email_senders;
CREATE TRIGGER update_trusted_email_senders_updated_at
  BEFORE UPDATE ON carletonlodge.trusted_email_senders
  FOR EACH ROW EXECUTE FUNCTION carletonlodge.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE
  ON carletonlodge.trusted_email_senders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON carletonlodge.trusted_email_senders TO service_role;

CREATE POLICY "Communications readers can view trusted senders"
  ON carletonlodge.trusted_email_senders FOR SELECT
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('communications', 'read'));

CREATE POLICY "Communications writers can add trusted senders"
  ON carletonlodge.trusted_email_senders FOR INSERT
  TO authenticated
  WITH CHECK (
    carletonlodge.has_admin_section_permission('communications', 'write')
    AND created_by = (SELECT auth.uid())
  );

CREATE POLICY "Communications writers can update trusted senders"
  ON carletonlodge.trusted_email_senders FOR UPDATE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('communications', 'write'))
  WITH CHECK (carletonlodge.has_admin_section_permission('communications', 'write'));

CREATE POLICY "Communications writers can delete trusted senders"
  ON carletonlodge.trusted_email_senders FOR DELETE
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('communications', 'write'));

CREATE TABLE IF NOT EXISTS carletonlodge.mailroom_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_email_id uuid NOT NULL UNIQUE
    REFERENCES carletonlodge.inbound_emails(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'drafting' CHECK (
    status IN ('drafting', 'needs_review', 'approved', 'rejected', 'failed')
  ),
  sender_email text NOT NULL,
  sender_verified boolean NOT NULL DEFAULT false,
  classification text CHECK (
    classification IS NULL
    OR classification IN ('summons', 'event', 'announcement', 'mixed', 'other')
  ),
  confidence numeric(4, 3) CHECK (
    confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
  ),
  summary text,
  extracted_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_payload jsonb,
  source_file_sha256 text,
  model text,
  prompt_version text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  published_summons_id uuid REFERENCES carletonlodge.summons(id) ON DELETE SET NULL,
  published_event_ids uuid[] NOT NULL DEFAULT '{}',
  published_announcement_ids uuid[] NOT NULL DEFAULT '{}',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mailroom_imports_review_state CHECK (
    (status IN ('drafting', 'needs_review', 'failed') AND reviewed_at IS NULL AND reviewed_by IS NULL)
    OR (status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
  )
);

ALTER TABLE carletonlodge.mailroom_imports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS mailroom_imports_review_queue_idx
  ON carletonlodge.mailroom_imports(status, created_at DESC);

DROP TRIGGER IF EXISTS update_mailroom_imports_updated_at
  ON carletonlodge.mailroom_imports;
CREATE TRIGGER update_mailroom_imports_updated_at
  BEFORE UPDATE ON carletonlodge.mailroom_imports
  FOR EACH ROW EXECUTE FUNCTION carletonlodge.update_updated_at_column();

GRANT SELECT ON carletonlodge.mailroom_imports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON carletonlodge.mailroom_imports TO service_role;

CREATE POLICY "Communications readers can view mailroom imports"
  ON carletonlodge.mailroom_imports FOR SELECT
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('communications', 'read'));

ALTER TABLE carletonlodge.summons
  ADD COLUMN IF NOT EXISTS source_mailroom_import_id uuid
    REFERENCES carletonlodge.mailroom_imports(id) ON DELETE SET NULL;
ALTER TABLE carletonlodge.events
  ADD COLUMN IF NOT EXISTS source_mailroom_import_id uuid
    REFERENCES carletonlodge.mailroom_imports(id) ON DELETE SET NULL;
ALTER TABLE carletonlodge.announcements
  ADD COLUMN IF NOT EXISTS source_mailroom_import_id uuid
    REFERENCES carletonlodge.mailroom_imports(id) ON DELETE SET NULL;
ALTER TABLE carletonlodge.documents
  ADD COLUMN IF NOT EXISTS source_mailroom_import_id uuid
    REFERENCES carletonlodge.mailroom_imports(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS summons_source_mailroom_import_unique
  ON carletonlodge.summons(source_mailroom_import_id)
  WHERE source_mailroom_import_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS documents_source_mailroom_import_unique
  ON carletonlodge.documents(source_mailroom_import_id)
  WHERE source_mailroom_import_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_source_mailroom_import_idx
  ON carletonlodge.events(source_mailroom_import_id)
  WHERE source_mailroom_import_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS announcements_source_mailroom_import_idx
  ON carletonlodge.announcements(source_mailroom_import_id)
  WHERE source_mailroom_import_id IS NOT NULL;

-- Keep summons delivery reliable for both manual uploads and Mailroom imports.
-- The existing sender function remains idempotent and may safely enqueue the
-- same keys again.
CREATE OR REPLACE FUNCTION carletonlodge_private.enqueue_summons_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, carletonlodge
AS $$
DECLARE
  recipient record;
BEGIN
  FOR recipient IN
    SELECT preferences.id, profiles.email
    FROM carletonlodge.notification_preferences AS preferences
    JOIN carletonlodge.profiles AS profiles ON profiles.id = preferences.id
    WHERE preferences.email_notifications = true
      AND preferences.notify_new_summons = true
  LOOP
    INSERT INTO carletonlodge.notification_outbox (
      notification_type,
      recipient_profile_id,
      recipient_email,
      payload,
      idempotency_key
    )
    VALUES (
      'new_summons',
      recipient.id,
      recipient.email,
      jsonb_build_object(
        'summons_id', NEW.id,
        'title', NEW.title,
        'month', NEW.month,
        'excerpt', left(NEW.content, 600)
      ),
      'new-summons:' || NEW.id || ':' || recipient.id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge_private.enqueue_summons_notifications()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enqueue_summons_notifications
  ON carletonlodge.summons;
CREATE TRIGGER enqueue_summons_notifications
  AFTER INSERT ON carletonlodge.summons
  FOR EACH ROW EXECUTE FUNCTION carletonlodge_private.enqueue_summons_notifications();

-- Publish every selected item in one database transaction. The model output is
-- never trusted directly: an authorized reviewer supplies the final payload,
-- and this function validates permissions and required fields again.
CREATE OR REPLACE FUNCTION carletonlodge.approve_mailroom_import(
  target_import_id uuid,
  reviewed_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, carletonlodge
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  import_row carletonlodge.mailroom_imports%ROWTYPE;
  summons_payload jsonb;
  event_payload jsonb;
  announcement_payload jsonb;
  source_file jsonb;
  new_summons_id uuid;
  new_event_id uuid;
  new_announcement_id uuid;
  event_ids uuid[] := '{}';
  announcement_ids uuid[] := '{}';
  notices_category_id uuid;
  event_visibility text;
  announcement_priority text;
  announcement_visibility text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authentication required';
  END IF;
  IF NOT carletonlodge.has_admin_section_permission('communications', 'write') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Communications write permission required';
  END IF;
  IF jsonb_typeof(reviewed_payload) <> 'object' THEN
    RAISE EXCEPTION 'A reviewed Mailroom payload is required';
  END IF;

  SELECT * INTO import_row
  FROM carletonlodge.mailroom_imports
  WHERE id = target_import_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mailroom import not found';
  END IF;
  IF import_row.status <> 'needs_review' THEN
    RAISE EXCEPTION 'Only a draft awaiting review can be approved';
  END IF;
  IF import_row.sender_verified IS NOT TRUE THEN
    RAISE EXCEPTION 'The sender and message authentication must be verified';
  END IF;

  summons_payload := reviewed_payload->'summons';
  IF summons_payload IS NOT NULL AND jsonb_typeof(summons_payload) <> 'null' THEN
    IF NOT carletonlodge.has_admin_section_permission('summons', 'write') THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Summons write permission required';
    END IF;
    IF length(btrim(coalesce(summons_payload->>'title', ''))) = 0
      OR length(btrim(coalesce(summons_payload->>'month', ''))) = 0
      OR length(btrim(coalesce(summons_payload->>'content', ''))) = 0 THEN
      RAISE EXCEPTION 'The summons title, month, and content are required';
    END IF;

    source_file := import_row.extracted_payload->'source_file';
    INSERT INTO carletonlodge.summons (
      title, month, content, pdf_url, created_by, source_mailroom_import_id
    ) VALUES (
      left(btrim(summons_payload->>'title'), 240),
      left(btrim(summons_payload->>'month'), 120),
      left(btrim(summons_payload->>'content'), 1000000),
      CASE
        WHEN source_file->>'storage_path' LIKE 'mailroom/' || import_row.id || '/%'
          THEN source_file->>'storage_path'
        ELSE NULL
      END,
      current_user_id,
      import_row.id
    ) RETURNING id INTO new_summons_id;

    IF source_file->>'storage_path' LIKE 'mailroom/' || import_row.id || '/%' THEN
      SELECT id INTO notices_category_id
      FROM carletonlodge.document_categories
      WHERE name = 'Notices & Summons'
      ORDER BY created_at
      LIMIT 1;

      INSERT INTO carletonlodge.documents (
        category_id, title, description, file_url, file_name, file_size,
        file_type, tags, storage_bucket, uploaded_by, source_mailroom_import_id
      ) VALUES (
        notices_category_id,
        left(btrim(summons_payload->>'title'), 240),
        left(btrim(summons_payload->>'month'), 120),
        source_file->>'storage_path',
        left(coalesce(nullif(source_file->>'file_name', ''), 'summons.pdf'), 255),
        CASE WHEN (source_file->>'file_size') ~ '^[0-9]+$'
          THEN (source_file->>'file_size')::bigint ELSE NULL END,
        'application/pdf',
        ARRAY['summons', lower(left(btrim(summons_payload->>'month'), 120))],
        'summons-uploads',
        current_user_id,
        import_row.id
      );
    END IF;
  END IF;

  IF jsonb_typeof(reviewed_payload->'events') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Events must be an array';
  END IF;
  IF jsonb_array_length(reviewed_payload->'events') > 12 THEN
    RAISE EXCEPTION 'A Mailroom import may publish no more than 12 events';
  END IF;
  IF jsonb_array_length(reviewed_payload->'events') > 0
    AND NOT carletonlodge.has_admin_section_permission('events', 'approve') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Event approval permission required';
  END IF;

  FOR event_payload IN
    SELECT value FROM jsonb_array_elements(reviewed_payload->'events')
  LOOP
    IF length(btrim(coalesce(event_payload->>'title', ''))) = 0
      OR length(btrim(coalesce(event_payload->>'event_date', ''))) = 0
      OR length(btrim(coalesce(event_payload->>'location', ''))) = 0 THEN
      RAISE EXCEPTION 'Each event needs a title, date, and location';
    END IF;
    event_visibility := coalesce(event_payload->>'visibility', 'members');
    IF event_visibility NOT IN ('public', 'members', 'admin') THEN
      RAISE EXCEPTION 'Invalid event visibility';
    END IF;

    INSERT INTO carletonlodge.events (
      title, description, event_date, event_time, event_end_time, location,
      location_address, poc_name, poc_contact, visibility, event_status,
      created_by, source_mailroom_import_id
    ) VALUES (
      left(btrim(event_payload->>'title'), 240),
      nullif(left(btrim(coalesce(event_payload->>'description', '')), 100000), ''),
      (event_payload->>'event_date')::date,
      nullif(event_payload->>'event_time', '')::time,
      nullif(event_payload->>'event_end_time', '')::time,
      left(btrim(event_payload->>'location'), 500),
      nullif(left(btrim(coalesce(event_payload->>'location_address', '')), 1000), ''),
      nullif(left(btrim(coalesce(event_payload->>'poc_name', '')), 200), ''),
      nullif(left(btrim(coalesce(event_payload->>'poc_contact', '')), 320), ''),
      event_visibility,
      'scheduled',
      current_user_id,
      import_row.id
    ) RETURNING id INTO new_event_id;
    event_ids := array_append(event_ids, new_event_id);
  END LOOP;

  IF jsonb_typeof(reviewed_payload->'announcements') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Announcements must be an array';
  END IF;
  IF jsonb_array_length(reviewed_payload->'announcements') > 12 THEN
    RAISE EXCEPTION 'A Mailroom import may publish no more than 12 announcements';
  END IF;

  FOR announcement_payload IN
    SELECT value FROM jsonb_array_elements(reviewed_payload->'announcements')
  LOOP
    IF length(btrim(coalesce(announcement_payload->>'title', ''))) = 0
      OR length(btrim(coalesce(announcement_payload->>'body', ''))) = 0 THEN
      RAISE EXCEPTION 'Each announcement needs a title and body';
    END IF;
    announcement_priority := coalesce(announcement_payload->>'priority', 'normal');
    announcement_visibility := coalesce(announcement_payload->>'visibility', 'members');
    IF announcement_priority NOT IN ('normal', 'important', 'urgent') THEN
      RAISE EXCEPTION 'Invalid announcement priority';
    END IF;
    IF announcement_visibility NOT IN ('public', 'members') THEN
      RAISE EXCEPTION 'Invalid announcement visibility';
    END IF;

    INSERT INTO carletonlodge.announcements (
      title, body, priority, visibility, is_published, published_at,
      created_by, source_mailroom_import_id
    ) VALUES (
      left(btrim(announcement_payload->>'title'), 240),
      left(btrim(announcement_payload->>'body'), 100000),
      announcement_priority,
      announcement_visibility,
      true,
      now(),
      current_user_id,
      import_row.id
    ) RETURNING id INTO new_announcement_id;
    announcement_ids := array_append(announcement_ids, new_announcement_id);
  END LOOP;

  IF new_summons_id IS NULL
    AND cardinality(event_ids) = 0
    AND cardinality(announcement_ids) = 0 THEN
    RAISE EXCEPTION 'Select at least one item to publish';
  END IF;

  UPDATE carletonlodge.mailroom_imports
  SET status = 'approved',
      approved_payload = reviewed_payload,
      reviewed_by = current_user_id,
      reviewed_at = now(),
      published_summons_id = new_summons_id,
      published_event_ids = event_ids,
      published_announcement_ids = announcement_ids,
      last_error = NULL
  WHERE id = import_row.id;

  UPDATE carletonlodge.inbound_emails
  SET processing_status = 'processed', processed_at = now(), last_error = NULL
  WHERE id = import_row.inbound_email_id;

  RETURN jsonb_build_object(
    'summons_id', new_summons_id,
    'event_ids', event_ids,
    'announcement_ids', announcement_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge.approve_mailroom_import(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION carletonlodge.approve_mailroom_import(uuid, jsonb)
  TO authenticated;

CREATE OR REPLACE FUNCTION carletonlodge.reject_mailroom_import(
  target_import_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, carletonlodge
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  inbound_id uuid;
BEGIN
  IF current_user_id IS NULL
    OR NOT carletonlodge.has_admin_section_permission('communications', 'write') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Communications write permission required';
  END IF;

  UPDATE carletonlodge.mailroom_imports
  SET status = 'rejected', reviewed_by = current_user_id, reviewed_at = now()
  WHERE id = target_import_id AND status = 'needs_review'
  RETURNING inbound_email_id INTO inbound_id;

  IF inbound_id IS NULL THEN
    RAISE EXCEPTION 'Draft not found or already reviewed';
  END IF;

  UPDATE carletonlodge.inbound_emails
  SET processing_status = 'ignored', processed_at = now(), last_error = NULL
  WHERE id = inbound_id;
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge.reject_mailroom_import(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION carletonlodge.reject_mailroom_import(uuid)
  TO authenticated;
