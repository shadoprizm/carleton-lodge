/*
  # Ottawa District 1 summons

  Keeps visiting-lodge information separate from Carleton Lodge records while
  reusing the audited Lodge Mailroom. Approved district summons, meetings, and
  officer details are visible only to authenticated lodge members.
*/

CREATE TABLE public.district_lodges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_name text NOT NULL DEFAULT 'Ottawa District 1',
  name text NOT NULL UNIQUE,
  lodge_number text,
  slug text NOT NULL UNIQUE,
  location text,
  website_url text,
  worshipful_master_name text,
  secretary_name text,
  contact_email text,
  contact_phone text,
  details_as_of date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT district_lodges_name_check CHECK (length(btrim(name)) BETWEEN 2 AND 200),
  CONSTRAINT district_lodges_slug_check CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT district_lodges_website_check CHECK (
    website_url IS NULL OR website_url ~ '^https://'
  ),
  CONSTRAINT district_lodges_email_check CHECK (
    contact_email IS NULL OR contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  )
);

CREATE TABLE public.district_summons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.district_lodges(id) ON DELETE RESTRICT,
  title text NOT NULL,
  issue_label text NOT NULL,
  issue_date date,
  content text NOT NULL,
  pdf_url text,
  source_mailroom_import_id uuid UNIQUE
    REFERENCES public.mailroom_imports(id) ON DELETE SET NULL,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT district_summons_title_check CHECK (length(btrim(title)) BETWEEN 2 AND 240),
  CONSTRAINT district_summons_issue_label_check CHECK (length(btrim(issue_label)) BETWEEN 2 AND 120),
  CONSTRAINT district_summons_content_check CHECK (length(btrim(content)) BETWEEN 2 AND 1000000)
);

CREATE TABLE public.district_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.district_lodges(id) ON DELETE RESTRICT,
  summons_id uuid NOT NULL REFERENCES public.district_summons(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  event_time time,
  event_end_time time,
  location text NOT NULL,
  location_address text,
  event_kind text NOT NULL DEFAULT 'meeting' CHECK (
    event_kind IN ('meeting', 'emergent', 'installation', 'social', 'official_visit', 'other')
  ),
  degree text NOT NULL DEFAULT 'unspecified' CHECK (
    degree IN ('unspecified', 'none', 'first', 'second', 'third', 'installation', 'other')
  ),
  contact_name text,
  contact_details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT district_events_title_check CHECK (length(btrim(title)) BETWEEN 2 AND 240),
  CONSTRAINT district_events_location_check CHECK (length(btrim(location)) BETWEEN 2 AND 500),
  CONSTRAINT district_events_unique UNIQUE NULLS NOT DISTINCT (lodge_id, event_date, event_time, title)
);

ALTER TABLE public.mailroom_imports
  ADD COLUMN published_district_summons_id uuid
    REFERENCES public.district_summons(id) ON DELETE SET NULL,
  ADD COLUMN published_district_event_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX district_summons_lodge_published_idx
  ON public.district_summons(lodge_id, published_at DESC);
CREATE INDEX district_summons_published_by_idx
  ON public.district_summons(published_by)
  WHERE published_by IS NOT NULL;
CREATE INDEX district_events_upcoming_idx
  ON public.district_events(event_date, event_time, lodge_id);
CREATE INDEX district_events_lodge_idx
  ON public.district_events(lodge_id, event_date DESC);
CREATE INDEX district_events_summons_idx
  ON public.district_events(summons_id);
CREATE INDEX mailroom_imports_published_district_summons_idx
  ON public.mailroom_imports(published_district_summons_id)
  WHERE published_district_summons_id IS NOT NULL;

ALTER TABLE public.district_lodges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.district_summons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.district_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.district_lodges TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.district_summons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.district_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.district_lodges TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.district_summons TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.district_events TO service_role;

CREATE POLICY "Members can view District 1 lodges"
  ON public.district_lodges FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
  ));
CREATE POLICY "Members can view District 1 summons"
  ON public.district_summons FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
  ));
CREATE POLICY "Members can view District 1 events"
  ON public.district_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
  ));

CREATE POLICY "Communications writers can create District 1 lodges"
  ON public.district_lodges FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_section_permission('communications', 'write'));
CREATE POLICY "Communications writers can update District 1 lodges"
  ON public.district_lodges FOR UPDATE TO authenticated
  USING (public.has_admin_section_permission('communications', 'write'))
  WITH CHECK (public.has_admin_section_permission('communications', 'write'));
CREATE POLICY "Communications writers can delete District 1 lodges"
  ON public.district_lodges FOR DELETE TO authenticated
  USING (public.has_admin_section_permission('communications', 'write'));

CREATE POLICY "Communications writers can create District 1 summons"
  ON public.district_summons FOR INSERT TO authenticated
  WITH CHECK (
    public.has_admin_section_permission('communications', 'write')
    AND published_by = (SELECT auth.uid())
  );
CREATE POLICY "Communications writers can update District 1 summons"
  ON public.district_summons FOR UPDATE TO authenticated
  USING (public.has_admin_section_permission('communications', 'write'))
  WITH CHECK (public.has_admin_section_permission('communications', 'write'));
CREATE POLICY "Communications writers can delete District 1 summons"
  ON public.district_summons FOR DELETE TO authenticated
  USING (public.has_admin_section_permission('communications', 'write'));

CREATE POLICY "Communications writers can create District 1 events"
  ON public.district_events FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_section_permission('communications', 'write'));
CREATE POLICY "Communications writers can update District 1 events"
  ON public.district_events FOR UPDATE TO authenticated
  USING (public.has_admin_section_permission('communications', 'write'))
  WITH CHECK (public.has_admin_section_permission('communications', 'write'));
CREATE POLICY "Communications writers can delete District 1 events"
  ON public.district_events FOR DELETE TO authenticated
  USING (public.has_admin_section_permission('communications', 'write'));

CREATE TRIGGER update_district_lodges_updated_at
  BEFORE UPDATE ON public.district_lodges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_district_summons_updated_at
  BEFORE UPDATE ON public.district_summons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_district_events_updated_at
  BEFORE UPDATE ON public.district_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.lodge_knowledge
  DROP CONSTRAINT lodge_knowledge_source_type_check;
ALTER TABLE public.lodge_knowledge
  ADD CONSTRAINT lodge_knowledge_source_type_check CHECK (source_type IN (
    'event', 'announcement', 'summons', 'document', 'history', 'member', 'help',
    'district_lodge', 'district_summons', 'district_event'
  ));

CREATE OR REPLACE FUNCTION carletonlodge_private.sync_district_lodge_knowledge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lodge_knowledge
    WHERE source_type = 'district_lodge' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO public.lodge_knowledge (
    source_type, source_id, title, body, keywords, source_url, visibility, source_updated_at
  ) VALUES (
    'district_lodge', NEW.id, NEW.name,
    carletonlodge_private.knowledge_plain_text(concat_ws(' ',
      NEW.district_name, NEW.lodge_number, NEW.location,
      'Worshipful Master', NEW.worshipful_master_name,
      'Secretary', NEW.secretary_name, NEW.contact_email, NEW.contact_phone,
      NEW.website_url, NEW.details_as_of::text
    )),
    concat_ws(' ', 'Ottawa District 1 visiting lodge officer master secretary contact', NEW.name, NEW.lodge_number),
    '/district#lodge-' || NEW.id, 'members', NEW.updated_at
  )
  ON CONFLICT (source_type, source_id) DO UPDATE SET
    title = EXCLUDED.title, body = EXCLUDED.body, keywords = EXCLUDED.keywords,
    source_url = EXCLUDED.source_url, visibility = EXCLUDED.visibility,
    source_updated_at = EXCLUDED.source_updated_at, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION carletonlodge_private.sync_district_summons_knowledge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE lodge_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lodge_knowledge
    WHERE source_type = 'district_summons' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  SELECT name INTO lodge_name FROM public.district_lodges WHERE id = NEW.lodge_id;
  INSERT INTO public.lodge_knowledge (
    source_type, source_id, title, body, keywords, source_url, visibility, source_updated_at
  ) VALUES (
    'district_summons', NEW.id, NEW.title,
    carletonlodge_private.knowledge_plain_text(concat_ws(' ', lodge_name, NEW.issue_label, NEW.issue_date::text, NEW.content)),
    concat_ws(' ', 'Ottawa District 1 visiting lodge summons notice agenda', lodge_name),
    '/district#summons-' || NEW.id, 'members', NEW.updated_at
  )
  ON CONFLICT (source_type, source_id) DO UPDATE SET
    title = EXCLUDED.title, body = EXCLUDED.body, keywords = EXCLUDED.keywords,
    source_url = EXCLUDED.source_url, source_updated_at = EXCLUDED.source_updated_at,
    updated_at = now();
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
  SELECT name INTO lodge_name FROM public.district_lodges WHERE id = NEW.lodge_id;
  INSERT INTO public.lodge_knowledge (
    source_type, source_id, title, body, keywords, source_url, visibility,
    valid_until, source_updated_at
  ) VALUES (
    'district_event', NEW.id, NEW.title,
    carletonlodge_private.knowledge_plain_text(concat_ws(' ',
      lodge_name, NEW.event_date::text, NEW.event_time::text, NEW.event_end_time::text,
      NEW.location, NEW.location_address, NEW.event_kind, NEW.degree, 'degree',
      NEW.contact_name, NEW.contact_details, NEW.description
    )),
    concat_ws(' ', 'Ottawa District 1 visiting lodge event meeting degree', lodge_name, NEW.degree, NEW.event_kind),
    '/district#event-' || NEW.id, 'members',
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

REVOKE ALL ON FUNCTION carletonlodge_private.sync_district_lodge_knowledge()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION carletonlodge_private.sync_district_summons_knowledge()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION carletonlodge_private.sync_district_event_knowledge()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER sync_district_lodge_knowledge
  AFTER INSERT OR UPDATE OR DELETE ON public.district_lodges
  FOR EACH ROW EXECUTE FUNCTION carletonlodge_private.sync_district_lodge_knowledge();
CREATE TRIGGER sync_district_summons_knowledge
  AFTER INSERT OR UPDATE OR DELETE ON public.district_summons
  FOR EACH ROW EXECUTE FUNCTION carletonlodge_private.sync_district_summons_knowledge();
CREATE TRIGGER sync_district_event_knowledge
  AFTER INSERT OR UPDATE OR DELETE ON public.district_events
  FOR EACH ROW EXECUTE FUNCTION carletonlodge_private.sync_district_event_knowledge();

CREATE OR REPLACE FUNCTION public.approve_district_mailroom_import(
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
  lodge_payload jsonb := reviewed_payload->'district_lodge';
  summons_payload jsonb := reviewed_payload->'summons';
  event_payload jsonb;
  source_file jsonb;
  target_lodge_id uuid;
  new_summons_id uuid;
  new_event_id uuid;
  event_ids uuid[] := '{}';
  lodge_name text;
  lodge_slug text;
  event_kind_value text;
  degree_value text;
BEGIN
  IF current_user_id IS NULL
    OR NOT public.has_admin_section_permission('communications', 'write') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Communications write permission required';
  END IF;
  IF jsonb_typeof(reviewed_payload) <> 'object' THEN
    RAISE EXCEPTION 'A reviewed District 1 payload is required';
  END IF;

  SELECT * INTO import_row
  FROM public.mailroom_imports
  WHERE id = target_import_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Mailroom import not found'; END IF;
  IF import_row.status <> 'needs_review' THEN
    RAISE EXCEPTION 'Only a draft awaiting review can be approved';
  END IF;
  IF import_row.sender_verified IS NOT TRUE THEN
    RAISE EXCEPTION 'The sender and message authentication must be verified';
  END IF;
  IF jsonb_typeof(lodge_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'District lodge details are required';
  END IF;
  lodge_name := btrim(coalesce(lodge_payload->>'name', ''));
  IF length(lodge_name) < 2 THEN RAISE EXCEPTION 'The lodge name is required'; END IF;
  IF jsonb_typeof(summons_payload) IS DISTINCT FROM 'object'
    OR length(btrim(coalesce(summons_payload->>'title', ''))) < 2
    OR length(btrim(coalesce(summons_payload->>'month', ''))) < 2
    OR length(btrim(coalesce(summons_payload->>'content', ''))) < 2 THEN
    RAISE EXCEPTION 'The district summons title, issue, and content are required';
  END IF;

  SELECT id INTO target_lodge_id
  FROM public.district_lodges
  WHERE lower(name) = lower(lodge_name)
  LIMIT 1;

  IF target_lodge_id IS NULL THEN
    lodge_slug := trim(both '-' from regexp_replace(lower(lodge_name), '[^a-z0-9]+', '-', 'g'));
    IF lodge_slug = '' THEN lodge_slug := 'district-lodge'; END IF;
    IF EXISTS (SELECT 1 FROM public.district_lodges WHERE slug = lodge_slug) THEN
      lodge_slug := lodge_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    END IF;
    INSERT INTO public.district_lodges (
      name, lodge_number, slug, location, website_url, worshipful_master_name,
      secretary_name, contact_email, contact_phone, details_as_of
    ) VALUES (
      lodge_name,
      nullif(left(btrim(coalesce(lodge_payload->>'lodge_number', '')), 80), ''),
      lodge_slug,
      nullif(left(btrim(coalesce(lodge_payload->>'location', '')), 500), ''),
      nullif(left(btrim(coalesce(lodge_payload->>'website_url', '')), 1000), ''),
      nullif(left(btrim(coalesce(lodge_payload->>'worshipful_master_name', '')), 240), ''),
      nullif(left(btrim(coalesce(lodge_payload->>'secretary_name', '')), 240), ''),
      nullif(left(lower(btrim(coalesce(lodge_payload->>'contact_email', ''))), 320), ''),
      nullif(left(btrim(coalesce(lodge_payload->>'contact_phone', '')), 80), ''),
      coalesce(nullif(lodge_payload->>'details_as_of', '')::date, current_date)
    ) RETURNING id INTO target_lodge_id;
  ELSE
    UPDATE public.district_lodges SET
      lodge_number = coalesce(nullif(left(btrim(coalesce(lodge_payload->>'lodge_number', '')), 80), ''), lodge_number),
      location = coalesce(nullif(left(btrim(coalesce(lodge_payload->>'location', '')), 500), ''), location),
      website_url = coalesce(nullif(left(btrim(coalesce(lodge_payload->>'website_url', '')), 1000), ''), website_url),
      worshipful_master_name = coalesce(nullif(left(btrim(coalesce(lodge_payload->>'worshipful_master_name', '')), 240), ''), worshipful_master_name),
      secretary_name = coalesce(nullif(left(btrim(coalesce(lodge_payload->>'secretary_name', '')), 240), ''), secretary_name),
      contact_email = coalesce(nullif(left(lower(btrim(coalesce(lodge_payload->>'contact_email', ''))), 320), ''), contact_email),
      contact_phone = coalesce(nullif(left(btrim(coalesce(lodge_payload->>'contact_phone', '')), 80), ''), contact_phone),
      details_as_of = coalesce(nullif(lodge_payload->>'details_as_of', '')::date, current_date)
    WHERE id = target_lodge_id;
  END IF;

  source_file := import_row.extracted_payload->'source_file';
  INSERT INTO public.district_summons (
    lodge_id, title, issue_label, issue_date, content, pdf_url,
    source_mailroom_import_id, published_by
  ) VALUES (
    target_lodge_id,
    left(btrim(summons_payload->>'title'), 240),
    left(btrim(summons_payload->>'month'), 120),
    nullif(summons_payload->>'issue_date', '')::date,
    left(btrim(summons_payload->>'content'), 1000000),
    CASE WHEN source_file->>'storage_path' LIKE 'mailroom/' || import_row.id || '/%'
      THEN source_file->>'storage_path' ELSE NULL END,
    import_row.id,
    current_user_id
  ) RETURNING id INTO new_summons_id;

  IF jsonb_typeof(reviewed_payload->'events') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Events must be an array';
  END IF;
  IF jsonb_array_length(reviewed_payload->'events') > 20 THEN
    RAISE EXCEPTION 'A District 1 summons may publish no more than 20 events';
  END IF;

  FOR event_payload IN SELECT value FROM jsonb_array_elements(reviewed_payload->'events')
  LOOP
    IF length(btrim(coalesce(event_payload->>'title', ''))) < 2
      OR length(btrim(coalesce(event_payload->>'event_date', ''))) = 0
      OR length(btrim(coalesce(event_payload->>'location', ''))) < 2 THEN
      RAISE EXCEPTION 'Each District 1 event needs a title, date, and location';
    END IF;
    event_kind_value := coalesce(nullif(event_payload->>'event_kind', ''), 'meeting');
    degree_value := coalesce(nullif(event_payload->>'degree', ''), 'unspecified');
    IF event_kind_value NOT IN ('meeting', 'emergent', 'installation', 'social', 'official_visit', 'other') THEN
      RAISE EXCEPTION 'Invalid District 1 event type';
    END IF;
    IF degree_value NOT IN ('unspecified', 'none', 'first', 'second', 'third', 'installation', 'other') THEN
      RAISE EXCEPTION 'Invalid District 1 degree';
    END IF;

    INSERT INTO public.district_events (
      lodge_id, summons_id, title, description, event_date, event_time,
      event_end_time, location, location_address, event_kind, degree,
      contact_name, contact_details
    ) VALUES (
      target_lodge_id, new_summons_id,
      left(btrim(event_payload->>'title'), 240),
      nullif(left(btrim(coalesce(event_payload->>'description', '')), 100000), ''),
      (event_payload->>'event_date')::date,
      nullif(event_payload->>'event_time', '')::time,
      nullif(event_payload->>'event_end_time', '')::time,
      left(btrim(event_payload->>'location'), 500),
      nullif(left(btrim(coalesce(event_payload->>'location_address', '')), 1000), ''),
      event_kind_value, degree_value,
      nullif(left(btrim(coalesce(event_payload->>'poc_name', '')), 240), ''),
      nullif(left(btrim(coalesce(event_payload->>'poc_contact', '')), 320), '')
    )
    ON CONFLICT (lodge_id, event_date, event_time, title) DO UPDATE SET
      summons_id = EXCLUDED.summons_id,
      description = EXCLUDED.description,
      event_end_time = EXCLUDED.event_end_time,
      location = EXCLUDED.location,
      location_address = EXCLUDED.location_address,
      event_kind = EXCLUDED.event_kind,
      degree = EXCLUDED.degree,
      contact_name = EXCLUDED.contact_name,
      contact_details = EXCLUDED.contact_details,
      updated_at = now()
    RETURNING id INTO new_event_id;
    event_ids := array_append(event_ids, new_event_id);
  END LOOP;

  UPDATE public.mailroom_imports SET
    status = 'approved', approved_payload = reviewed_payload,
    reviewed_by = current_user_id, reviewed_at = now(),
    published_district_summons_id = new_summons_id,
    published_district_event_ids = event_ids,
    last_error = NULL
  WHERE id = import_row.id;

  UPDATE public.inbound_emails SET
    processing_status = 'processed', processed_at = now(), last_error = NULL
  WHERE id = import_row.inbound_email_id;

  RETURN jsonb_build_object(
    'district_lodge_id', target_lodge_id,
    'district_summons_id', new_summons_id,
    'district_event_ids', event_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_district_mailroom_import(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_district_mailroom_import(uuid, jsonb)
  TO authenticated;
