/*
  # Intelligent Lodge Mailroom

  Extends the reviewed Mailroom into a durable, multi-action intake pipeline.
  Inbound messages may be prepared automatically, but publication remains an
  explicit Communications-administrator transaction.
*/

ALTER TABLE public.inbound_emails
  ADD COLUMN IF NOT EXISTS received_for_addresses text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS message_sha256 text,
  ADD COLUMN IF NOT EXISTS retention_until timestamptz NOT NULL DEFAULT (now() + interval '1 year'),
  ADD COLUMN IF NOT EXISTS purge_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_purged_at timestamptz;

CREATE INDEX IF NOT EXISTS inbound_emails_message_sha256_idx
  ON public.inbound_emails(message_sha256, received_at DESC)
  WHERE message_sha256 IS NOT NULL;
CREATE INDEX IF NOT EXISTS inbound_emails_retention_idx
  ON public.inbound_emails(retention_until)
  WHERE content_purged_at IS NULL;

ALTER TABLE public.mailroom_imports
  ADD COLUMN IF NOT EXISTS processing_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS classification_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_scope text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS source_issuer text,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS available_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS duplicate_of_import_id uuid
    REFERENCES public.mailroom_imports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_attachment_sha256 text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS published_document_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.mailroom_imports
  DROP CONSTRAINT IF EXISTS mailroom_imports_status_check,
  DROP CONSTRAINT IF EXISTS mailroom_imports_review_state,
  ADD CONSTRAINT mailroom_imports_status_check CHECK (
    status IN ('queued', 'drafting', 'needs_review', 'approved', 'rejected', 'failed', 'duplicate')
  ),
  ADD CONSTRAINT mailroom_imports_processing_mode_check CHECK (
    processing_mode IN ('manual', 'shadow', 'active')
  ),
  ADD CONSTRAINT mailroom_imports_source_scope_check CHECK (
    source_scope IN ('carleton', 'district_1', 'district_2', 'outside_scope', 'unknown')
  ),
  ADD CONSTRAINT mailroom_imports_attempt_count_check CHECK (
    attempt_count >= 0 AND max_attempts BETWEEN 1 AND 10
  ),
  ADD CONSTRAINT mailroom_imports_review_state CHECK (
    (status IN ('queued', 'drafting', 'needs_review', 'failed', 'duplicate')
      AND reviewed_at IS NULL AND reviewed_by IS NULL)
    OR (status IN ('approved', 'rejected')
      AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
  );

DROP INDEX IF EXISTS public.mailroom_imports_review_queue_idx;
CREATE INDEX mailroom_imports_review_queue_idx
  ON public.mailroom_imports(created_at DESC)
  WHERE status = 'needs_review';
CREATE INDEX mailroom_imports_delivery_idx
  ON public.mailroom_imports(available_at, created_at)
  WHERE status IN ('queued', 'drafting');
CREATE INDEX mailroom_imports_duplicate_idx
  ON public.mailroom_imports(duplicate_of_import_id)
  WHERE duplicate_of_import_id IS NOT NULL;

ALTER TABLE public.summons
  ADD COLUMN IF NOT EXISTS notify_members boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_in_lodge_guide boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_issuer text;
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS notify_members boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_in_lodge_guide boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_issuer text;
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS notice_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS notify_members boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_in_lodge_guide boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_issuer text;
ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_notice_type_check,
  ADD CONSTRAINT announcements_notice_type_check CHECK (
    notice_type IN ('general', 'memorial')
  ),
  ADD CONSTRAINT announcements_memorial_privacy_check CHECK (
    notice_type <> 'memorial'
    OR (visibility = 'members' AND include_in_lodge_guide = false AND expires_at IS NOT NULL)
  );

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS source_issuer text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS rights_reviewed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_in_lodge_guide boolean NOT NULL DEFAULT false;
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_source_url_check,
  ADD CONSTRAINT documents_source_url_check CHECK (
    source_url IS NULL OR source_url ~ '^https://[^[:space:]]+$'
  ),
  ADD CONSTRAINT documents_guide_rights_check CHECK (
    include_in_lodge_guide = false OR rights_reviewed = true
  );

DROP INDEX IF EXISTS public.documents_source_mailroom_import_unique;
CREATE INDEX IF NOT EXISTS documents_source_mailroom_import_idx
  ON public.documents(source_mailroom_import_id)
  WHERE source_mailroom_import_id IS NOT NULL;

ALTER TABLE public.district_events
  ADD COLUMN IF NOT EXISTS source_mailroom_import_id uuid
    REFERENCES public.mailroom_imports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_issuer text,
  ADD COLUMN IF NOT EXISTS include_in_lodge_guide boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS district_events_source_mailroom_import_idx
  ON public.district_events(source_mailroom_import_id)
  WHERE source_mailroom_import_id IS NOT NULL;

ALTER TABLE public.district_summons
  ADD COLUMN IF NOT EXISTS source_issuer text,
  ADD COLUMN IF NOT EXISTS include_in_lodge_guide boolean NOT NULL DEFAULT true;

INSERT INTO public.document_categories (name, description, display_order)
SELECT 'Masonic Education', 'Reviewed educational material with recorded source and sharing rights',
       coalesce((SELECT max(display_order) + 1 FROM public.document_categories), 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_categories WHERE name = 'Masonic Education'
);

-- Claim queue rows atomically so scheduled and manual workers cannot prepare
-- the same message concurrently.
CREATE OR REPLACE FUNCTION private.claim_mailroom_imports(batch_size integer DEFAULT 3)
RETURNS SETOF public.mailroom_imports
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  UPDATE public.mailroom_imports AS job
  SET status = 'drafting',
      locked_at = now(),
      attempt_count = job.attempt_count + 1,
      updated_at = now()
  WHERE job.id IN (
    SELECT candidate.id
    FROM public.mailroom_imports AS candidate
    WHERE (
      candidate.status = 'queued'
      OR (candidate.status = 'drafting' AND candidate.locked_at < now() - interval '15 minutes')
    )
      AND candidate.available_at <= now()
      AND candidate.attempt_count < candidate.max_attempts
    ORDER BY candidate.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT least(greatest(batch_size, 1), 10)
  )
  RETURNING job.*;
$$;

REVOKE ALL ON FUNCTION private.claim_mailroom_imports(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.claim_mailroom_imports(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_mailroom_imports(batch_size integer DEFAULT 3)
RETURNS SETOF public.mailroom_imports
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
  SELECT * FROM private.claim_mailroom_imports(batch_size);
$$;
REVOKE ALL ON FUNCTION public.claim_mailroom_imports(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mailroom_imports(integer) TO service_role;

-- Notification defaults are evaluated only after the reviewer approves the
-- action. A false per-record value prevents the normal publication trigger.
CREATE OR REPLACE FUNCTION carletonlodge_private.enqueue_summons_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE recipient record;
BEGIN
  IF NEW.notify_members IS NOT TRUE THEN RETURN NEW; END IF;
  FOR recipient IN
    SELECT preferences.id, profiles.email
    FROM public.notification_preferences AS preferences
    JOIN public.profiles AS profiles ON profiles.id = preferences.id
    WHERE preferences.email_notifications = true
      AND preferences.notify_new_summons = true
      AND profiles.email IS NOT NULL
  LOOP
    INSERT INTO public.notification_outbox (
      notification_type, recipient_profile_id, recipient_email, payload, idempotency_key
    ) VALUES (
      'new_summons', recipient.id, recipient.email,
      jsonb_build_object('summons_id', NEW.id, 'title', NEW.title,
        'month', NEW.month, 'excerpt', left(NEW.content, 600)),
      'new-summons:' || NEW.id || ':' || recipient.id
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION carletonlodge_private.enqueue_member_event_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE recipient record; message_type text; message_key text;
BEGIN
  IF NEW.visibility = 'admin' OR NEW.notify_members IS NOT TRUE THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    message_type := 'new_event'; message_key := 'new-event:' || NEW.id;
  ELSE
    message_type := 'event_updated';
    message_key := 'event-update:' || NEW.id || ':' || extract(epoch FROM NEW.updated_at)::text;
  END IF;
  FOR recipient IN
    SELECT preferences.id, profiles.email
    FROM public.notification_preferences AS preferences
    JOIN public.profiles AS profiles ON profiles.id = preferences.id
    WHERE preferences.email_notifications = true
      AND profiles.email IS NOT NULL
      AND ((TG_OP = 'INSERT' AND preferences.notify_new_events = true)
        OR (TG_OP = 'UPDATE' AND preferences.notify_event_updates = true))
  LOOP
    INSERT INTO public.notification_outbox (
      notification_type, recipient_profile_id, recipient_email, payload, idempotency_key
    ) VALUES (
      message_type, recipient.id, recipient.email,
      jsonb_build_object('event_id', NEW.id, 'title', NEW.title,
        'event_date', NEW.event_date, 'event_time', NEW.event_time,
        'location', NEW.location, 'event_status', NEW.event_status,
        'status_note', NEW.status_note),
      message_key || ':' || recipient.id
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION carletonlodge_private.enqueue_announcement_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE recipient record;
BEGIN
  IF NEW.is_published = false OR NEW.notify_members IS NOT TRUE
    OR (TG_OP = 'UPDATE' AND OLD.is_published = true) THEN RETURN NEW; END IF;
  FOR recipient IN
    SELECT preferences.id, profiles.email
    FROM public.notification_preferences AS preferences
    JOIN public.profiles AS profiles ON profiles.id = preferences.id
    WHERE preferences.email_notifications = true
      AND preferences.notify_announcements = true
      AND profiles.email IS NOT NULL
  LOOP
    INSERT INTO public.notification_outbox (
      notification_type, recipient_profile_id, recipient_email, payload, idempotency_key
    ) VALUES (
      'new_announcement', recipient.id, recipient.email,
      jsonb_build_object('announcement_id', NEW.id, 'title', NEW.title,
        'body', NEW.body, 'priority', NEW.priority,
        'notice_type', NEW.notice_type),
      'new-announcement:' || NEW.id || ':' || recipient.id
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

-- Lodge Guide indexing respects explicit inclusion controls. Memorial notices
-- remain excluded even if a malformed client attempts to opt them in.
CREATE OR REPLACE FUNCTION carletonlodge_private.sync_event_knowledge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lodge_knowledge WHERE source_type = 'event' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.include_in_lodge_guide IS NOT TRUE THEN
    DELETE FROM public.lodge_knowledge WHERE source_type = 'event' AND source_id = NEW.id;
    RETURN NEW;
  END IF;
  INSERT INTO public.lodge_knowledge
    (source_type, source_id, title, body, keywords, source_url, visibility, source_updated_at)
  VALUES ('event', NEW.id, NEW.title,
    carletonlodge_private.knowledge_plain_text(concat_ws(' ', NEW.description,
      NEW.event_date::text, NEW.event_time::text, NEW.location,
      NEW.location_address, NEW.event_status, NEW.status_note, NEW.source_issuer)),
    'calendar meeting event date time location cancellation postponement',
    '/calendar', NEW.visibility, NEW.updated_at)
  ON CONFLICT (source_type, source_id) DO UPDATE SET
    title = EXCLUDED.title, body = EXCLUDED.body, keywords = EXCLUDED.keywords,
    source_url = EXCLUDED.source_url, visibility = EXCLUDED.visibility,
    source_updated_at = EXCLUDED.source_updated_at, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION carletonlodge_private.sync_announcement_knowledge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lodge_knowledge WHERE source_type = 'announcement' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.is_published = false OR NEW.include_in_lodge_guide IS NOT TRUE
    OR NEW.notice_type = 'memorial' THEN
    DELETE FROM public.lodge_knowledge WHERE source_type = 'announcement' AND source_id = NEW.id;
    RETURN NEW;
  END IF;
  INSERT INTO public.lodge_knowledge
    (source_type, source_id, title, body, keywords, source_url, visibility,
     valid_until, source_updated_at)
  VALUES ('announcement', NEW.id, NEW.title,
    carletonlodge_private.knowledge_plain_text(NEW.body),
    concat_ws(' ', NEW.priority, NEW.notice_type, 'notice announcement', NEW.source_issuer),
    CASE WHEN NEW.visibility = 'members' THEN '/my-lodge' ELSE '/' END,
    NEW.visibility, NEW.expires_at, NEW.updated_at)
  ON CONFLICT (source_type, source_id) DO UPDATE SET
    title = EXCLUDED.title, body = EXCLUDED.body, keywords = EXCLUDED.keywords,
    source_url = EXCLUDED.source_url, visibility = EXCLUDED.visibility,
    valid_until = EXCLUDED.valid_until, source_updated_at = EXCLUDED.source_updated_at,
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION carletonlodge_private.sync_summons_knowledge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lodge_knowledge WHERE source_type = 'summons' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.include_in_lodge_guide IS NOT TRUE THEN
    DELETE FROM public.lodge_knowledge WHERE source_type = 'summons' AND source_id = NEW.id;
    RETURN NEW;
  END IF;
  INSERT INTO public.lodge_knowledge
    (source_type, source_id, title, body, keywords, source_url, visibility, source_updated_at)
  VALUES ('summons', NEW.id, NEW.title,
    carletonlodge_private.knowledge_plain_text(NEW.month || ' ' || NEW.content),
    concat_ws(' ', 'summons monthly notice agenda', NEW.source_issuer),
    '/summons', 'members', NEW.updated_at)
  ON CONFLICT (source_type, source_id) DO UPDATE SET
    title = EXCLUDED.title, body = EXCLUDED.body, keywords = EXCLUDED.keywords,
    source_updated_at = EXCLUDED.source_updated_at, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION carletonlodge_private.sync_document_knowledge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lodge_knowledge WHERE source_type = 'document' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.include_in_lodge_guide IS NOT TRUE OR NEW.rights_reviewed IS NOT TRUE THEN
    DELETE FROM public.lodge_knowledge WHERE source_type = 'document' AND source_id = NEW.id;
    RETURN NEW;
  END IF;
  INSERT INTO public.lodge_knowledge
    (source_type, source_id, title, body, keywords, source_url, visibility, source_updated_at)
  VALUES ('document', NEW.id, NEW.title,
    carletonlodge_private.knowledge_plain_text(concat_ws(' ', NEW.description,
      NEW.file_name, NEW.source_issuer)),
    concat_ws(' ', array_to_string(NEW.tags, ' '), NEW.source_issuer),
    '/library', 'members', NEW.updated_at)
  ON CONFLICT (source_type, source_id) DO UPDATE SET
    title = EXCLUDED.title, body = EXCLUDED.body, keywords = EXCLUDED.keywords,
    source_updated_at = EXCLUDED.source_updated_at, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION carletonlodge_private.sync_district_summons_knowledge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE lodge_name text; source_district text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lodge_knowledge
    WHERE source_type = 'district_summons' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.include_in_lodge_guide IS NOT TRUE THEN
    DELETE FROM public.lodge_knowledge
    WHERE source_type = 'district_summons' AND source_id = NEW.id;
    RETURN NEW;
  END IF;
  SELECT name, district_name INTO lodge_name, source_district
  FROM public.district_lodges WHERE id = NEW.lodge_id;
  INSERT INTO public.lodge_knowledge (
    source_type, source_id, title, body, keywords, source_url, visibility,
    source_updated_at
  ) VALUES (
    'district_summons', NEW.id, NEW.title,
    carletonlodge_private.knowledge_plain_text(concat_ws(' ', lodge_name,
      source_district, NEW.issue_label, NEW.issue_date::text, NEW.content,
      NEW.source_issuer)),
    concat_ws(' ', source_district, 'visiting lodge summons notice agenda',
      lodge_name, NEW.source_issuer),
    '/district#summons-' || NEW.id, 'members', NEW.updated_at
  )
  ON CONFLICT (source_type, source_id) DO UPDATE SET
    title = EXCLUDED.title, body = EXCLUDED.body, keywords = EXCLUDED.keywords,
    source_url = EXCLUDED.source_url, visibility = EXCLUDED.visibility,
    source_updated_at = EXCLUDED.source_updated_at, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION carletonlodge_private.sync_district_event_knowledge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE lodge_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lodge_knowledge
    WHERE source_type = 'district_event' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.include_in_lodge_guide IS NOT TRUE THEN
    DELETE FROM public.lodge_knowledge
    WHERE source_type = 'district_event' AND source_id = NEW.id;
    RETURN NEW;
  END IF;
  IF NEW.lodge_id IS NOT NULL THEN
    SELECT name INTO lodge_name FROM public.district_lodges WHERE id = NEW.lodge_id;
  END IF;
  INSERT INTO public.lodge_knowledge (
    source_type, source_id, title, body, keywords, source_url, visibility,
    valid_until, source_updated_at
  ) VALUES (
    'district_event', NEW.id, NEW.title,
    carletonlodge_private.knowledge_plain_text(concat_ws(' ',
      NEW.district_name, lodge_name, NEW.event_date::text, NEW.event_time::text,
      NEW.event_end_time::text, NEW.location, NEW.location_address, NEW.event_kind,
      NEW.degree, 'degree', NEW.contact_name, NEW.contact_details, NEW.description,
      NEW.source_checked_at::text, NEW.source_issuer
    )),
    concat_ws(' ', NEW.district_name, 'visiting lodge event meeting degree',
      lodge_name, NEW.degree, NEW.event_kind, NEW.source_issuer),
    coalesce(NEW.source_url, '/district#event-' || NEW.id), 'members',
    ((NEW.event_date + 1)::timestamp AT TIME ZONE 'America/Toronto'), NEW.updated_at
  )
  ON CONFLICT (source_type, source_id) DO UPDATE SET
    title = EXCLUDED.title, body = EXCLUDED.body, keywords = EXCLUDED.keywords,
    source_url = EXCLUDED.source_url, visibility = EXCLUDED.visibility,
    valid_until = EXCLUDED.valid_until, source_updated_at = EXCLUDED.source_updated_at,
    updated_at = now();
  RETURN NEW;
END;
$$;

-- A prepared draft notifies full and delegated Communications administrators.
CREATE OR REPLACE FUNCTION carletonlodge_private.enqueue_mailroom_review_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE recipient record;
BEGIN
  IF NEW.status <> 'needs_review' OR OLD.status = 'needs_review' THEN RETURN NEW; END IF;
  FOR recipient IN
    SELECT DISTINCT profiles.id, profiles.email
    FROM public.profiles
    LEFT JOIN public.admin_section_permissions AS permission
      ON permission.profile_id = profiles.id AND permission.section = 'communications'
    WHERE profiles.email IS NOT NULL
      AND (profiles.is_admin = true OR permission.can_write = true)
  LOOP
    INSERT INTO public.notification_outbox (
      notification_type, recipient_profile_id, recipient_email, payload, idempotency_key
    ) VALUES (
      'mailroom_draft_ready', recipient.id, recipient.email,
      jsonb_build_object('import_id', NEW.id, 'summary', NEW.summary,
        'source_issuer', NEW.source_issuer, 'processing_mode', NEW.processing_mode,
        'classification_tags', NEW.classification_tags),
      'mailroom-draft-ready:' || NEW.id || ':' || recipient.id
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION carletonlodge_private.enqueue_mailroom_review_notification()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enqueue_mailroom_review_notification ON public.mailroom_imports;
CREATE TRIGGER enqueue_mailroom_review_notification
  AFTER UPDATE OF status ON public.mailroom_imports
  FOR EACH ROW EXECUTE FUNCTION carletonlodge_private.enqueue_mailroom_review_notification();

-- Publish independently reviewed action groups in one transaction. Every
-- destination and privacy switch is validated again at the database boundary.
CREATE OR REPLACE FUNCTION private.approve_intelligent_mailroom_import(
  target_import_id uuid,
  reviewed_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  import_row public.mailroom_imports%ROWTYPE;
  summons_payload jsonb := reviewed_payload->'summons';
  lodge_payload jsonb := reviewed_payload->'district_lodge';
  event_payload jsonb;
  announcement_payload jsonb;
  library_payload jsonb;
  library_source_file jsonb;
  source_files jsonb := coalesce(reviewed_payload->'source_files', '[]'::jsonb);
  source_file jsonb;
  source_path text;
  source_name text;
  destination text;
  district_name_value text;
  district_lodge_id uuid;
  new_summons_id uuid;
  new_district_summons_id uuid;
  new_event_id uuid;
  new_announcement_id uuid;
  new_document_id uuid;
  event_ids uuid[] := '{}';
  district_event_ids uuid[] := '{}';
  announcement_ids uuid[] := '{}';
  document_ids uuid[] := '{}';
  notices_category_id uuid;
  education_category_id uuid;
  event_visibility text;
  event_kind_value text;
  degree_value text;
  notice_type_value text;
  rights_value boolean;
BEGIN
  IF current_user_id IS NULL
    OR NOT public.has_admin_section_permission('communications', 'write') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Communications write permission required';
  END IF;
  IF jsonb_typeof(reviewed_payload) <> 'object' THEN
    RAISE EXCEPTION 'A reviewed Mailroom payload is required';
  END IF;

  SELECT * INTO import_row FROM public.mailroom_imports
  WHERE id = target_import_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mailroom import not found'; END IF;
  IF import_row.status <> 'needs_review' THEN
    RAISE EXCEPTION 'Only a draft awaiting review can be approved';
  END IF;
  IF import_row.processing_mode = 'shadow' THEN
    RAISE EXCEPTION 'Shadow-test drafts cannot be published';
  END IF;
  IF import_row.sender_verified IS NOT TRUE THEN
    RAISE EXCEPTION 'The sender and message authentication must be verified';
  END IF;
  IF 'sensitive_hold' = ANY(import_row.classification_tags)
    AND NOT import_row.classification_tags && ARRAY[
      'carleton_summons', 'district_summons', 'carleton_event',
      'district_event', 'memorial_notice', 'announcement', 'library_item'
    ]::text[] THEN
    RAISE EXCEPTION 'Sensitive correspondence cannot be published';
  END IF;
  IF import_row.source_scope = 'outside_scope' AND (
    coalesce(reviewed_payload->'summons'->>'destination', '') = 'district'
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(coalesce(reviewed_payload->'events', '[]'::jsonb)) AS proposed_event
      WHERE proposed_event->>'destination' = 'district'
    )
  ) THEN
    RAISE EXCEPTION 'Material outside Ottawa Districts 1 and 2 must remain on hold';
  END IF;

  source_file := CASE WHEN jsonb_array_length(source_files) > 0 THEN source_files->0
    ELSE import_row.extracted_payload->'source_file' END;
  source_path := source_file->>'storage_path';
  source_name := coalesce(nullif(source_file->>'file_name', ''), 'mailroom-source.txt');

  IF summons_payload IS NOT NULL AND jsonb_typeof(summons_payload) <> 'null' THEN
    IF NOT public.has_admin_section_permission('summons', 'write') THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Summons write permission required';
    END IF;
    IF length(btrim(coalesce(summons_payload->>'title', ''))) < 2
      OR length(btrim(coalesce(summons_payload->>'month', ''))) < 2
      OR length(btrim(coalesce(summons_payload->>'content', ''))) < 2 THEN
      RAISE EXCEPTION 'The summons title, issue, and content are required';
    END IF;
    destination := coalesce(summons_payload->>'destination', reviewed_payload->>'publication_target');
    IF destination = 'carleton' THEN
      SELECT id INTO new_summons_id FROM public.summons
      WHERE lower(month) = lower(btrim(summons_payload->>'month'))
        AND lower(title) = lower(btrim(summons_payload->>'title')) LIMIT 1;
      IF new_summons_id IS NULL THEN
        INSERT INTO public.summons (
          title, month, content, pdf_url, created_by, source_mailroom_import_id,
          notify_members, include_in_lodge_guide, source_issuer
        ) VALUES (
          left(btrim(summons_payload->>'title'), 240),
          left(btrim(summons_payload->>'month'), 120),
          left(btrim(summons_payload->>'content'), 1000000),
          CASE WHEN source_path LIKE 'mailroom/' || import_row.id || '/%'
            AND (source_file->>'content_type' = 'application/pdf'
              OR lower(source_name) LIKE '%.pdf') THEN source_path END,
          current_user_id, import_row.id,
          coalesce((summons_payload->>'notify_members')::boolean, true),
          coalesce((summons_payload->>'include_in_lodge_guide')::boolean, true),
          nullif(left(btrim(coalesce(reviewed_payload->>'source_issuer', import_row.source_issuer, '')), 240), '')
        ) RETURNING id INTO new_summons_id;
      END IF;
      IF source_path LIKE 'mailroom/' || import_row.id || '/%' THEN
        SELECT id INTO notices_category_id FROM public.document_categories
        WHERE name = 'Notices & Summons' ORDER BY created_at LIMIT 1;
        INSERT INTO public.documents (
          category_id, title, description, file_url, file_name, file_size,
          file_type, tags, storage_bucket, uploaded_by, source_mailroom_import_id,
          source_issuer, rights_reviewed, include_in_lodge_guide
        ) VALUES (
          notices_category_id, left(btrim(summons_payload->>'title'), 240),
          left(btrim(summons_payload->>'month'), 120), source_path,
          left(source_name, 255),
          CASE WHEN source_file->>'file_size' ~ '^[0-9]+$' THEN (source_file->>'file_size')::bigint END,
          coalesce(nullif(source_file->>'content_type', ''), 'application/octet-stream'),
          ARRAY['summons', lower(left(btrim(summons_payload->>'month'), 120))],
          'summons-uploads', current_user_id, import_row.id,
          nullif(left(btrim(coalesce(reviewed_payload->>'source_issuer', import_row.source_issuer, '')), 240), ''),
          true, false
        ) RETURNING id INTO new_document_id;
        document_ids := array_append(document_ids, new_document_id);
      END IF;
    ELSIF destination = 'district' THEN
      district_lodge_id := nullif(coalesce(summons_payload->>'district_lodge_id', lodge_payload->>'id'), '')::uuid;
      SELECT district_name INTO district_name_value FROM public.district_lodges
      WHERE id = district_lodge_id;
      IF district_name_value NOT IN ('Ottawa District 1', 'Ottawa District 2') THEN
        RAISE EXCEPTION 'A summons must match an approved Ottawa District 1 or 2 lodge';
      END IF;
      SELECT id INTO new_district_summons_id FROM public.district_summons
      WHERE lodge_id = district_lodge_id
        AND lower(issue_label) = lower(btrim(summons_payload->>'month'))
        AND lower(title) = lower(btrim(summons_payload->>'title')) LIMIT 1;
      IF new_district_summons_id IS NULL THEN
        INSERT INTO public.district_summons (
          lodge_id, title, issue_label, issue_date, content, pdf_url,
          source_mailroom_import_id, published_by, source_issuer,
          include_in_lodge_guide
        ) VALUES (
          district_lodge_id, left(btrim(summons_payload->>'title'), 240),
          left(btrim(summons_payload->>'month'), 120),
          nullif(summons_payload->>'issue_date', '')::date,
          left(btrim(summons_payload->>'content'), 1000000),
          CASE WHEN source_path LIKE 'mailroom/' || import_row.id || '/%'
            AND (source_file->>'content_type' = 'application/pdf'
              OR lower(source_name) LIKE '%.pdf') THEN source_path END,
          import_row.id, current_user_id,
          nullif(left(btrim(coalesce(reviewed_payload->>'source_issuer', import_row.source_issuer, '')), 240), ''),
          coalesce((summons_payload->>'include_in_lodge_guide')::boolean, true)
        ) RETURNING id INTO new_district_summons_id;
      END IF;
    ELSE RAISE EXCEPTION 'Choose a valid summons destination';
    END IF;
  END IF;

  IF jsonb_typeof(coalesce(reviewed_payload->'events', '[]'::jsonb)) <> 'array'
    OR jsonb_array_length(coalesce(reviewed_payload->'events', '[]'::jsonb)) > 20 THEN
    RAISE EXCEPTION 'Events must be an array of no more than 20 items';
  END IF;
  IF jsonb_array_length(coalesce(reviewed_payload->'events', '[]'::jsonb)) > 0
    AND NOT public.has_admin_section_permission('events', 'approve') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Event approval permission required';
  END IF;
  FOR event_payload IN SELECT value FROM jsonb_array_elements(coalesce(reviewed_payload->'events', '[]'::jsonb))
  LOOP
    IF length(btrim(coalesce(event_payload->>'title', ''))) < 2
      OR coalesce(event_payload->>'event_date', '') = ''
      OR length(btrim(coalesce(event_payload->>'location', ''))) < 2 THEN
      RAISE EXCEPTION 'Each event needs a title, date, and location';
    END IF;
    destination := coalesce(event_payload->>'destination', reviewed_payload->>'publication_target');
    IF destination = 'carleton' THEN
      event_visibility := CASE WHEN coalesce((event_payload->>'is_memorial_service')::boolean, false)
        THEN 'members' ELSE coalesce(event_payload->>'visibility', 'members') END;
      IF event_visibility NOT IN ('public', 'members', 'admin') THEN RAISE EXCEPTION 'Invalid event visibility'; END IF;
      SELECT id INTO new_event_id FROM public.events
      WHERE event_date = (event_payload->>'event_date')::date
        AND event_time IS NOT DISTINCT FROM nullif(event_payload->>'event_time', '')::time
        AND lower(title) = lower(btrim(event_payload->>'title'))
        AND lower(location) = lower(btrim(event_payload->>'location')) LIMIT 1;
      IF new_event_id IS NULL THEN
        INSERT INTO public.events (
          title, description, event_date, event_time, event_end_time, location,
          location_address, poc_name, poc_contact, visibility, event_status,
          created_by, source_mailroom_import_id, notify_members,
          include_in_lodge_guide, source_issuer
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
          event_visibility, 'scheduled', current_user_id, import_row.id,
          coalesce((event_payload->>'notify_members')::boolean, true),
          CASE WHEN coalesce((event_payload->>'is_memorial_service')::boolean, false)
            THEN false ELSE coalesce((event_payload->>'include_in_lodge_guide')::boolean, true) END,
          nullif(left(btrim(coalesce(event_payload->>'source_issuer', reviewed_payload->>'source_issuer', import_row.source_issuer, '')), 240), '')
        ) RETURNING id INTO new_event_id;
      END IF;
      event_ids := array_append(event_ids, new_event_id);
    ELSIF destination = 'district' THEN
      district_name_value := coalesce(event_payload->>'district_name',
        CASE import_row.source_scope WHEN 'district_1' THEN 'Ottawa District 1'
          WHEN 'district_2' THEN 'Ottawa District 2' END);
      IF district_name_value NOT IN ('Ottawa District 1', 'Ottawa District 2') THEN
        RAISE EXCEPTION 'District events are limited to Ottawa Districts 1 and 2';
      END IF;
      district_lodge_id := nullif(coalesce(event_payload->>'district_lodge_id', lodge_payload->>'id'), '')::uuid;
      IF district_lodge_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.district_lodges
        WHERE id = district_lodge_id AND district_name = district_name_value
      ) THEN RAISE EXCEPTION 'The event lodge is not in the approved district directory'; END IF;
      event_kind_value := coalesce(nullif(event_payload->>'event_kind', ''), 'meeting');
      degree_value := coalesce(nullif(event_payload->>'degree', ''), 'unspecified');
      IF event_kind_value NOT IN ('meeting','emergent','installation','social','official_visit','other')
        OR degree_value NOT IN ('unspecified','none','first','second','third','installation','other') THEN
        RAISE EXCEPTION 'Invalid District event type or degree';
      END IF;
      SELECT id INTO new_event_id FROM public.district_events
      WHERE district_name = district_name_value
        AND lodge_id IS NOT DISTINCT FROM district_lodge_id
        AND event_date = (event_payload->>'event_date')::date
        AND event_time IS NOT DISTINCT FROM nullif(event_payload->>'event_time', '')::time
        AND lower(title) = lower(btrim(event_payload->>'title')) LIMIT 1;
      IF new_event_id IS NULL THEN
        INSERT INTO public.district_events (
          lodge_id, summons_id, district_name, title, description, event_date,
          event_time, event_end_time, location, location_address, event_kind,
          degree, contact_name, contact_details, source_mailroom_import_id,
          source_issuer, include_in_lodge_guide
        ) VALUES (
          district_lodge_id, new_district_summons_id, district_name_value,
          left(btrim(event_payload->>'title'), 240),
          nullif(left(btrim(coalesce(event_payload->>'description', '')), 100000), ''),
          (event_payload->>'event_date')::date,
          nullif(event_payload->>'event_time', '')::time,
          nullif(event_payload->>'event_end_time', '')::time,
          left(btrim(event_payload->>'location'), 500),
          nullif(left(btrim(coalesce(event_payload->>'location_address', '')), 1000), ''),
          event_kind_value, degree_value,
          nullif(left(btrim(coalesce(event_payload->>'poc_name', '')), 240), ''),
          nullif(left(btrim(coalesce(event_payload->>'poc_contact', '')), 320), ''),
          import_row.id,
          nullif(left(btrim(coalesce(event_payload->>'source_issuer', reviewed_payload->>'source_issuer', import_row.source_issuer, '')), 240), ''),
          CASE WHEN coalesce((event_payload->>'is_memorial_service')::boolean, false)
            THEN false ELSE coalesce((event_payload->>'include_in_lodge_guide')::boolean, true) END
        ) RETURNING id INTO new_event_id;
      END IF;
      district_event_ids := array_append(district_event_ids, new_event_id);
    ELSE RAISE EXCEPTION 'Choose a valid destination for every event';
    END IF;
  END LOOP;

  IF jsonb_typeof(coalesce(reviewed_payload->'announcements', '[]'::jsonb)) <> 'array'
    OR jsonb_array_length(coalesce(reviewed_payload->'announcements', '[]'::jsonb)) > 12 THEN
    RAISE EXCEPTION 'Announcements must be an array of no more than 12 items';
  END IF;
  FOR announcement_payload IN SELECT value FROM jsonb_array_elements(coalesce(reviewed_payload->'announcements', '[]'::jsonb))
  LOOP
    IF length(btrim(coalesce(announcement_payload->>'title', ''))) < 2
      OR length(btrim(coalesce(announcement_payload->>'body', ''))) < 2 THEN
      RAISE EXCEPTION 'Each notice needs a title and body';
    END IF;
    notice_type_value := coalesce(announcement_payload->>'notice_type', 'general');
    IF notice_type_value NOT IN ('general', 'memorial') THEN RAISE EXCEPTION 'Invalid notice type'; END IF;
    INSERT INTO public.announcements (
      title, body, priority, visibility, is_published, published_at, expires_at,
      created_by, source_mailroom_import_id, notice_type, notify_members,
      include_in_lodge_guide, source_issuer
    ) VALUES (
      left(btrim(announcement_payload->>'title'), 200),
      left(btrim(announcement_payload->>'body'), 10000),
      CASE WHEN announcement_payload->>'priority' IN ('normal','important','urgent')
        THEN announcement_payload->>'priority' ELSE 'normal' END,
      CASE WHEN notice_type_value = 'memorial' THEN 'members'
        WHEN announcement_payload->>'visibility' IN ('public','members')
          THEN announcement_payload->>'visibility' ELSE 'members' END,
      true, now(),
      CASE WHEN notice_type_value = 'memorial' THEN
        coalesce(nullif(announcement_payload->>'expires_at', '')::timestamptz, now() + interval '90 days')
        ELSE nullif(announcement_payload->>'expires_at', '')::timestamptz END,
      current_user_id, import_row.id, notice_type_value,
      coalesce((announcement_payload->>'notify_members')::boolean, notice_type_value <> 'memorial'),
      CASE WHEN notice_type_value = 'memorial' THEN false
        ELSE coalesce((announcement_payload->>'include_in_lodge_guide')::boolean, true) END,
      nullif(left(btrim(coalesce(announcement_payload->>'source_issuer', reviewed_payload->>'source_issuer', import_row.source_issuer, '')), 240), '')
    ) RETURNING id INTO new_announcement_id;
    announcement_ids := array_append(announcement_ids, new_announcement_id);
  END LOOP;

  IF jsonb_typeof(coalesce(reviewed_payload->'library_items', '[]'::jsonb)) <> 'array'
    OR jsonb_array_length(coalesce(reviewed_payload->'library_items', '[]'::jsonb)) > 12 THEN
    RAISE EXCEPTION 'Library items must be an array of no more than 12 items';
  END IF;
  IF jsonb_array_length(coalesce(reviewed_payload->'library_items', '[]'::jsonb)) > 0
    AND NOT public.has_admin_section_permission('library', 'write') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Library write permission required';
  END IF;
  SELECT id INTO education_category_id FROM public.document_categories
  WHERE name = 'Masonic Education' ORDER BY created_at LIMIT 1;
  FOR library_payload IN SELECT value FROM jsonb_array_elements(coalesce(reviewed_payload->'library_items', '[]'::jsonb))
  LOOP
    IF length(btrim(coalesce(library_payload->>'title', ''))) < 2 THEN
      RAISE EXCEPTION 'Each Library item needs a title';
    END IF;
    source_path := coalesce(nullif(library_payload->>'source_storage_path', ''), source_file->>'storage_path');
    IF source_path NOT LIKE 'mailroom/' || import_row.id || '/%' THEN
      RAISE EXCEPTION 'Every Library item must retain an approved Mailroom source file';
    END IF;
    SELECT value INTO library_source_file
    FROM jsonb_array_elements(source_files)
    WHERE value->>'storage_path' = source_path
    LIMIT 1;
    IF library_source_file IS NULL THEN
      library_source_file := source_file;
    END IF;
    rights_value := coalesce((library_payload->>'rights_reviewed')::boolean, false);
    INSERT INTO public.documents (
      category_id, title, description, file_url, file_name, file_size, file_type,
      tags, storage_bucket, uploaded_by, source_mailroom_import_id, source_issuer,
      source_url, rights_reviewed, include_in_lodge_guide
    ) VALUES (
      education_category_id, left(btrim(library_payload->>'title'), 240),
      nullif(left(btrim(coalesce(library_payload->>'summary', '')), 10000), ''),
      source_path, left(coalesce(nullif(library_payload->>'file_name', ''),
        library_source_file->>'file_name', source_name), 255),
      CASE WHEN library_source_file->>'file_size' ~ '^[0-9]+$'
        THEN (library_source_file->>'file_size')::bigint END,
      coalesce(nullif(library_source_file->>'content_type', ''), 'application/octet-stream'),
      ARRAY(SELECT left(value, 80) FROM jsonb_array_elements_text(coalesce(library_payload->'tags', '[]'::jsonb)) AS value LIMIT 20),
      'summons-uploads', current_user_id, import_row.id,
      nullif(left(btrim(coalesce(library_payload->>'source', reviewed_payload->>'source_issuer', import_row.source_issuer, '')), 240), ''),
      nullif(left(btrim(coalesce(library_payload->>'source_url', '')), 2000), ''),
      rights_value,
      CASE WHEN rights_value THEN coalesce((library_payload->>'include_in_lodge_guide')::boolean, false) ELSE false END
    ) RETURNING id INTO new_document_id;
    document_ids := array_append(document_ids, new_document_id);
  END LOOP;

  IF new_summons_id IS NULL AND new_district_summons_id IS NULL
    AND cardinality(event_ids) = 0 AND cardinality(district_event_ids) = 0
    AND cardinality(announcement_ids) = 0 AND cardinality(document_ids) = 0 THEN
    RAISE EXCEPTION 'Keep at least one proposed action before publishing';
  END IF;

  UPDATE public.mailroom_imports SET
    status = 'approved', approved_payload = reviewed_payload,
    reviewed_by = current_user_id, reviewed_at = now(),
    published_summons_id = new_summons_id,
    published_event_ids = event_ids,
    published_announcement_ids = announcement_ids,
    published_district_summons_id = new_district_summons_id,
    published_district_event_ids = district_event_ids,
    published_document_ids = document_ids,
    locked_at = NULL, last_error = NULL
  WHERE id = import_row.id;
  UPDATE public.inbound_emails SET
    processing_status = 'processed', processed_at = now(), last_error = NULL,
    retention_until = 'infinity'::timestamptz
  WHERE id = import_row.inbound_email_id;

  RETURN jsonb_build_object(
    'summons_id', new_summons_id,
    'district_summons_id', new_district_summons_id,
    'event_ids', event_ids,
    'district_event_ids', district_event_ids,
    'announcement_ids', announcement_ids,
    'document_ids', document_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION private.approve_intelligent_mailroom_import(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.approve_intelligent_mailroom_import(uuid, jsonb)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.approve_intelligent_mailroom_import(
  target_import_id uuid,
  reviewed_payload jsonb
)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog
AS $$
  SELECT private.approve_intelligent_mailroom_import(target_import_id, reviewed_payload);
$$;
REVOKE ALL ON FUNCTION public.approve_intelligent_mailroom_import(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_intelligent_mailroom_import(uuid, jsonb)
  TO authenticated, service_role;

-- The existing service-role Vault secret also authenticates the notification
-- cron. Reuse it for queue retries and daily retention cleanup.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'carletonlodge-process-mailroom') THEN
    PERFORM cron.unschedule('carletonlodge-process-mailroom');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'carletonlodge-purge-mailroom') THEN
    PERFORM cron.unschedule('carletonlodge-purge-mailroom');
  END IF;
END $$;

SELECT cron.schedule(
  'carletonlodge-process-mailroom', '*/2 * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://isnxsygngysxgzeuhmjm.supabase.co/functions/v1/cl-mailroom',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'carletonlodge_cron_service_role'
        )
      ),
      body := jsonb_build_object('action', 'processQueue', 'batchSize', 3),
      timeout_milliseconds := 120000
    );
  $cron$
);

SELECT cron.schedule(
  'carletonlodge-purge-mailroom', '41 3 * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://isnxsygngysxgzeuhmjm.supabase.co/functions/v1/cl-mailroom',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'carletonlodge_cron_service_role'
        )
      ),
      body := jsonb_build_object('action', 'purgeExpired', 'batchSize', 50),
      timeout_milliseconds := 120000
    );
  $cron$
);
