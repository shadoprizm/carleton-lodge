/*
  # Member event approvals and email foundation

  Calendar:
  - Members submit proposed events into a private approval queue.
  - Only users with the Events "approve" capability (or full admins) can
    approve/reject submissions.
  - Approval atomically publishes a copy to the existing events table.
  - Direct client inserts into events are removed so every new event follows
    the approval path.

  Email:
  - Adds a durable, provider-neutral notification outbox.
  - Adds normalized inbound email storage.
  - Adds a Communications admin section for scoped read/write access.
  - Queues approval-request and approval-result messages; delivery remains the
    responsibility of the provider adapter Edge Function.

  This migration is written directly for the carletonlodge tenant schema in
  the Shared A Supabase project. Shared auth and storage schemas are untouched.
*/

-- Extend delegated permissions with an approval capability and a separately
-- assignable Communications section.
ALTER TABLE carletonlodge.admin_section_permissions
  ADD COLUMN IF NOT EXISTS can_approve boolean NOT NULL DEFAULT false;

ALTER TABLE carletonlodge.admin_section_permissions
  DROP CONSTRAINT IF EXISTS admin_section_permissions_section_check;

ALTER TABLE carletonlodge.admin_section_permissions
  ADD CONSTRAINT admin_section_permissions_section_check CHECK (
    section IN (
      'members',
      'events',
      'summons',
      'library',
      'history',
      'gallery',
      'contact',
      'communications'
    )
  );

ALTER TABLE carletonlodge.admin_section_permissions
  DROP CONSTRAINT IF EXISTS admin_section_permissions_has_access;

ALTER TABLE carletonlodge.admin_section_permissions
  ADD CONSTRAINT admin_section_permissions_has_access CHECK (
    can_read = true OR can_write = true OR can_approve = true
  );

ALTER TABLE carletonlodge.admin_section_permissions
  DROP CONSTRAINT IF EXISTS admin_section_permissions_approval_scope;

ALTER TABLE carletonlodge.admin_section_permissions
  ADD CONSTRAINT admin_section_permissions_approval_scope CHECK (
    can_approve = false OR section = 'events'
  );

CREATE OR REPLACE FUNCTION carletonlodge.has_admin_section_permission(
  target_section text,
  access_level text DEFAULT 'read'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, carletonlodge
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

  IF access_level = 'approve' THEN
    RETURN target_section = 'events' AND EXISTS (
      SELECT 1
      FROM carletonlodge.admin_section_permissions
      WHERE profile_id = current_user_id
        AND section = target_section
        AND can_approve = true
    );
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
      AND (can_read = true OR can_write = true OR can_approve = true)
  );
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge.has_admin_section_permission(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION carletonlodge.has_admin_section_permission(text, text) TO authenticated;

-- Provider-neutral email infrastructure. Business actions enqueue typed jobs;
-- an Edge Function renders the message and hands it to the configured provider.
CREATE TABLE IF NOT EXISTS carletonlodge.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email')),
  notification_type text NOT NULL,
  recipient_profile_id uuid REFERENCES carletonlodge.profiles(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'processing', 'sent', 'failed', 'cancelled')
  ),
  provider text,
  provider_message_id text,
  idempotency_key text NOT NULL UNIQUE,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE carletonlodge.notification_outbox ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS notification_outbox_delivery_idx
  ON carletonlodge.notification_outbox(status, available_at, created_at)
  WHERE status IN ('queued', 'processing');

CREATE INDEX IF NOT EXISTS notification_outbox_recipient_profile_idx
  ON carletonlodge.notification_outbox(recipient_profile_id);

DROP TRIGGER IF EXISTS update_notification_outbox_updated_at
  ON carletonlodge.notification_outbox;
CREATE TRIGGER update_notification_outbox_updated_at
  BEFORE UPDATE ON carletonlodge.notification_outbox
  FOR EACH ROW EXECUTE FUNCTION carletonlodge.update_updated_at_column();

CREATE TABLE IF NOT EXISTS carletonlodge.inbound_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_message_id text NOT NULL,
  from_address text,
  to_addresses text[] NOT NULL DEFAULT '{}',
  cc_addresses text[] NOT NULL DEFAULT '{}',
  subject text,
  text_body text,
  html_body text,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_status text NOT NULL DEFAULT 'received' CHECK (
    processing_status IN ('received', 'processing', 'processed', 'ignored', 'failed')
  ),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inbound_emails_provider_message_unique
    UNIQUE (provider, provider_message_id)
);

ALTER TABLE carletonlodge.inbound_emails ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS inbound_emails_received_at_idx
  ON carletonlodge.inbound_emails(received_at DESC);

DROP TRIGGER IF EXISTS update_inbound_emails_updated_at
  ON carletonlodge.inbound_emails;
CREATE TRIGGER update_inbound_emails_updated_at
  BEFORE UPDATE ON carletonlodge.inbound_emails
  FOR EACH ROW EXECUTE FUNCTION carletonlodge.update_updated_at_column();

GRANT SELECT ON carletonlodge.notification_outbox TO authenticated;
GRANT SELECT ON carletonlodge.inbound_emails TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON carletonlodge.notification_outbox TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON carletonlodge.inbound_emails TO service_role;

DROP POLICY IF EXISTS "Communications readers can view notification outbox"
  ON carletonlodge.notification_outbox;
CREATE POLICY "Communications readers can view notification outbox"
  ON carletonlodge.notification_outbox FOR SELECT
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('communications', 'read'));

DROP POLICY IF EXISTS "Communications readers can view inbound emails"
  ON carletonlodge.inbound_emails;
CREATE POLICY "Communications readers can view inbound emails"
  ON carletonlodge.inbound_emails FOR SELECT
  TO authenticated
  USING (carletonlodge.has_admin_section_permission('communications', 'read'));

-- A private schema holds trigger functions that require elevated privileges.
-- They cannot be called through the Data API.
CREATE SCHEMA IF NOT EXISTS carletonlodge_private;
REVOKE ALL ON SCHEMA carletonlodge_private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION carletonlodge.claim_notification_outbox(
  batch_size integer DEFAULT 25
)
RETURNS SETOF carletonlodge.notification_outbox
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, carletonlodge
AS $$
  UPDATE carletonlodge.notification_outbox AS outbox
  SET
    status = 'processing',
    locked_at = now(),
    attempt_count = outbox.attempt_count + 1,
    updated_at = now()
  WHERE outbox.id IN (
    SELECT candidate.id
    FROM carletonlodge.notification_outbox AS candidate
    WHERE (
        candidate.status = 'queued'
        OR (
          candidate.status = 'processing'
          AND candidate.locked_at < now() - interval '15 minutes'
        )
      )
      AND candidate.available_at <= now()
      AND candidate.attempt_count < candidate.max_attempts
    ORDER BY candidate.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(batch_size, 1), 100)
  )
  RETURNING outbox.*;
$$;

REVOKE ALL ON FUNCTION carletonlodge.claim_notification_outbox(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION carletonlodge.claim_notification_outbox(integer) TO service_role;

-- Members propose events here. Published events remain isolated in events.
CREATE TABLE IF NOT EXISTS carletonlodge.event_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  description text,
  event_date date NOT NULL,
  event_time time,
  event_end_time time,
  location text NOT NULL CHECK (length(btrim(location)) > 0),
  location_address text,
  poc_name text,
  poc_contact text,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected')
  ),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitter_email text NOT NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  published_event_id uuid REFERENCES carletonlodge.events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_submissions_time_order CHECK (
    event_time IS NULL
    OR event_end_time IS NULL
    OR event_end_time > event_time
  ),
  CONSTRAINT event_submissions_review_state CHECK (
    (
      status = 'pending'
      AND reviewed_by IS NULL
      AND reviewed_at IS NULL
      AND published_event_id IS NULL
    )
    OR (
      status = 'approved'
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND published_event_id IS NOT NULL
    )
    OR (
      status = 'rejected'
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND published_event_id IS NULL
    )
  )
);

ALTER TABLE carletonlodge.event_submissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS event_submissions_review_queue_idx
  ON carletonlodge.event_submissions(status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS event_submissions_created_by_idx
  ON carletonlodge.event_submissions(created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS event_submissions_published_event_idx
  ON carletonlodge.event_submissions(published_event_id)
  WHERE published_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS event_submissions_reviewed_by_idx
  ON carletonlodge.event_submissions(reviewed_by)
  WHERE reviewed_by IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON carletonlodge.event_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON carletonlodge.event_submissions TO service_role;

CREATE OR REPLACE FUNCTION carletonlodge_private.prepare_event_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, carletonlodge
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_user_email text;
  new_event_id uuid;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'An authenticated lodge member is required';
  END IF;

  SELECT email
  INTO current_user_email
  FROM carletonlodge.profiles
  WHERE id = current_user_id;

  IF current_user_email IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'A Carleton Lodge member profile is required';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := current_user_id;
    NEW.submitter_email := current_user_email;
    NEW.status := 'pending';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.review_notes := NULL;
    NEW.published_event_id := NULL;
    NEW.created_at := now();
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  NEW.created_by := OLD.created_by;
  NEW.submitter_email := OLD.submitter_email;
  NEW.created_at := OLD.created_at;
  NEW.published_event_id := OLD.published_event_id;

  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'Reviewed event submissions are immutable';
  END IF;

  IF NEW.status = 'pending' THEN
    IF current_user_id <> OLD.created_by
      AND NOT carletonlodge.has_admin_section_permission('events', 'write') THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'You are not allowed to edit this event submission';
    END IF;

    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.review_notes := NULL;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('approved', 'rejected')
    OR NOT carletonlodge.has_admin_section_permission('events', 'approve') THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Event approval permission is required';
  END IF;

  NEW.reviewed_by := current_user_id;
  NEW.reviewed_at := now();
  NEW.updated_at := now();

  IF NEW.status = 'approved' THEN
    INSERT INTO carletonlodge.events (
      title,
      description,
      event_date,
      event_time,
      event_end_time,
      location,
      location_address,
      poc_name,
      poc_contact,
      created_by
    )
    VALUES (
      btrim(NEW.title),
      NEW.description,
      NEW.event_date,
      NEW.event_time,
      NEW.event_end_time,
      btrim(NEW.location),
      NULLIF(btrim(NEW.location_address), ''),
      NULLIF(btrim(NEW.poc_name), ''),
      NULLIF(btrim(NEW.poc_contact), ''),
      NEW.created_by
    )
    RETURNING id INTO new_event_id;

    NEW.published_event_id := new_event_id;
  ELSE
    NEW.published_event_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge_private.prepare_event_submission()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prepare_event_submission
  ON carletonlodge.event_submissions;
CREATE TRIGGER prepare_event_submission
  BEFORE INSERT OR UPDATE ON carletonlodge.event_submissions
  FOR EACH ROW EXECUTE FUNCTION carletonlodge_private.prepare_event_submission();

CREATE OR REPLACE FUNCTION carletonlodge_private.enqueue_event_submission_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, carletonlodge
AS $$
DECLARE
  recipient record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    FOR recipient IN
      SELECT DISTINCT p.id, p.email
      FROM carletonlodge.profiles AS p
      WHERE p.is_admin = true
        OR EXISTS (
          SELECT 1
          FROM carletonlodge.admin_section_permissions AS permission
          WHERE permission.profile_id = p.id
            AND permission.section = 'events'
            AND permission.can_approve = true
        )
    LOOP
      INSERT INTO carletonlodge.notification_outbox (
        notification_type,
        recipient_profile_id,
        recipient_email,
        payload,
        idempotency_key
      )
      VALUES (
        'event_approval_requested',
        recipient.id,
        recipient.email,
        jsonb_build_object(
          'submission_id', NEW.id,
          'title', NEW.title,
          'event_date', NEW.event_date,
          'submitted_by', NEW.submitter_email
        ),
        'event-submission:' || NEW.id || ':approval-request:' || recipient.id
      )
      ON CONFLICT (idempotency_key) DO NOTHING;
    END LOOP;

    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
    INSERT INTO carletonlodge.notification_outbox (
      notification_type,
      recipient_profile_id,
      recipient_email,
      payload,
      idempotency_key
    )
    VALUES (
      'event_submission_approved',
      NEW.created_by,
      NEW.submitter_email,
      jsonb_build_object(
        'submission_id', NEW.id,
        'event_id', NEW.published_event_id,
        'title', NEW.title,
        'event_date', NEW.event_date,
        'review_notes', NEW.review_notes
      ),
      'event-submission:' || NEW.id || ':approved'
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  ELSIF OLD.status = 'pending' AND NEW.status = 'rejected' THEN
    INSERT INTO carletonlodge.notification_outbox (
      notification_type,
      recipient_profile_id,
      recipient_email,
      payload,
      idempotency_key
    )
    VALUES (
      'event_submission_rejected',
      NEW.created_by,
      NEW.submitter_email,
      jsonb_build_object(
        'submission_id', NEW.id,
        'title', NEW.title,
        'event_date', NEW.event_date,
        'review_notes', NEW.review_notes
      ),
      'event-submission:' || NEW.id || ':rejected'
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge_private.enqueue_event_submission_notifications()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enqueue_event_submission_notifications
  ON carletonlodge.event_submissions;
CREATE TRIGGER enqueue_event_submission_notifications
  AFTER INSERT OR UPDATE OF status ON carletonlodge.event_submissions
  FOR EACH ROW EXECUTE FUNCTION carletonlodge_private.enqueue_event_submission_notifications();

DROP POLICY IF EXISTS "Members can submit pending events"
  ON carletonlodge.event_submissions;
CREATE POLICY "Members can submit pending events"
  ON carletonlodge.event_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND published_event_id IS NULL
  );

DROP POLICY IF EXISTS "Members and event managers can view event submissions"
  ON carletonlodge.event_submissions;
CREATE POLICY "Members and event managers can view event submissions"
  ON carletonlodge.event_submissions FOR SELECT
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR carletonlodge.has_admin_section_permission('events', 'read')
  );

DROP POLICY IF EXISTS "Members and event managers can update pending event submissions"
  ON carletonlodge.event_submissions;
CREATE POLICY "Members and event managers can update pending event submissions"
  ON carletonlodge.event_submissions FOR UPDATE
  TO authenticated
  USING (
    status = 'pending'
    AND (
      created_by = (SELECT auth.uid())
      OR carletonlodge.has_admin_section_permission('events', 'write')
      OR carletonlodge.has_admin_section_permission('events', 'approve')
    )
  )
  WITH CHECK (
    (
      status = 'pending'
      AND reviewed_by IS NULL
      AND reviewed_at IS NULL
      AND published_event_id IS NULL
      AND (
        created_by = (SELECT auth.uid())
        OR carletonlodge.has_admin_section_permission('events', 'write')
      )
    )
    OR (
      status IN ('approved', 'rejected')
      AND reviewed_by = (SELECT auth.uid())
      AND reviewed_at IS NOT NULL
      AND carletonlodge.has_admin_section_permission('events', 'approve')
    )
  );

DROP POLICY IF EXISTS "Members and event editors can delete pending event submissions"
  ON carletonlodge.event_submissions;
CREATE POLICY "Members and event editors can delete pending event submissions"
  ON carletonlodge.event_submissions FOR DELETE
  TO authenticated
  USING (
    status = 'pending'
    AND (
      created_by = (SELECT auth.uid())
      OR carletonlodge.has_admin_section_permission('events', 'write')
    )
  );

-- Force every new calendar entry through event_submissions. Existing event
-- editors retain update/delete access to already-published events.
DROP POLICY IF EXISTS "Authenticated users can create events" ON carletonlodge.events;
DROP POLICY IF EXISTS "Event editors can create events" ON carletonlodge.events;
