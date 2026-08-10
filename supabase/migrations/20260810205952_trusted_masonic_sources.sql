/*
  # Trusted Masonic web sources

  Adds a reviewed, members-only knowledge pipeline for the Grand Lodge of
  Ontario, Ottawa Districts 1 and 2, and lodge sites listed by those districts.
  Public sites are fetched by a scheduled Edge Function; the model never gets
  unrestricted browsing authority.
*/

CREATE TABLE public.trusted_knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  authority text NOT NULL CHECK (authority IN (
    'grand_lodge', 'district_1', 'district_2', 'lodge'
  )),
  district_name text CHECK (
    district_name IS NULL OR district_name IN ('Ottawa District 1', 'Ottawa District 2')
  ),
  source_kind text NOT NULL DEFAULT 'page' CHECK (source_kind IN ('page', 'calendar_ics')),
  source_url text NOT NULL UNIQUE,
  domain text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  allow_live_search boolean NOT NULL DEFAULT true,
  refresh_interval_minutes integer NOT NULL DEFAULT 1440
    CHECK (refresh_interval_minutes BETWEEN 60 AND 43200),
  fetch_status text NOT NULL DEFAULT 'pending'
    CHECK (fetch_status IN ('pending', 'refreshing', 'healthy', 'unchanged', 'error')),
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_changed_at timestamptz,
  last_http_status integer,
  last_error text,
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  etag text,
  last_modified text,
  content_hash text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trusted_knowledge_sources_name_check
    CHECK (length(btrim(name)) BETWEEN 2 AND 240),
  CONSTRAINT trusted_knowledge_sources_url_check
    CHECK (source_url ~ '^https://[^[:space:]]+$' AND length(source_url) <= 2000),
  CONSTRAINT trusted_knowledge_sources_domain_check
    CHECK (
      domain = lower(domain)
      AND domain ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'
    )
);

CREATE TABLE public.trusted_knowledge_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL UNIQUE
    REFERENCES public.trusted_knowledge_sources(id) ON DELETE CASCADE,
  canonical_url text NOT NULL,
  title text NOT NULL,
  clean_text text NOT NULL,
  content_hash text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  source_published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trusted_knowledge_pages_url_check
    CHECK (canonical_url ~ '^https://[^[:space:]]+$' AND length(canonical_url) <= 2000),
  CONSTRAINT trusted_knowledge_pages_title_check
    CHECK (length(btrim(title)) BETWEEN 1 AND 500),
  CONSTRAINT trusted_knowledge_pages_text_check
    CHECK (length(btrim(clean_text)) BETWEEN 1 AND 250000)
);

ALTER TABLE public.trusted_knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_knowledge_pages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trusted_knowledge_sources TO authenticated;
GRANT SELECT ON public.trusted_knowledge_pages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trusted_knowledge_sources TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trusted_knowledge_pages TO service_role;

CREATE POLICY "Communications readers can view trusted knowledge sources"
  ON public.trusted_knowledge_sources FOR SELECT TO authenticated
  USING (public.has_admin_section_permission('communications', 'read'));
CREATE POLICY "Communications writers can create trusted knowledge sources"
  ON public.trusted_knowledge_sources FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_section_permission('communications', 'write'));
CREATE POLICY "Communications writers can update trusted knowledge sources"
  ON public.trusted_knowledge_sources FOR UPDATE TO authenticated
  USING (public.has_admin_section_permission('communications', 'write'))
  WITH CHECK (public.has_admin_section_permission('communications', 'write'));
CREATE POLICY "Communications writers can delete trusted knowledge sources"
  ON public.trusted_knowledge_sources FOR DELETE TO authenticated
  USING (public.has_admin_section_permission('communications', 'write'));
CREATE POLICY "Communications readers can preview trusted knowledge pages"
  ON public.trusted_knowledge_pages FOR SELECT TO authenticated
  USING (public.has_admin_section_permission('communications', 'read'));

CREATE TRIGGER update_trusted_knowledge_sources_updated_at
  BEFORE UPDATE ON public.trusted_knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trusted_knowledge_pages_updated_at
  BEFORE UPDATE ON public.trusted_knowledge_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX trusted_knowledge_sources_due_idx
  ON public.trusted_knowledge_sources(enabled, last_checked_at)
  WHERE enabled = true;
CREATE INDEX trusted_knowledge_sources_authority_idx
  ON public.trusted_knowledge_sources(authority, district_name, name);
CREATE INDEX trusted_knowledge_sources_created_by_idx
  ON public.trusted_knowledge_sources(created_by)
  WHERE created_by IS NOT NULL;

ALTER TABLE public.lodge_knowledge
  DROP CONSTRAINT IF EXISTS lodge_knowledge_source_type_check;
ALTER TABLE public.lodge_knowledge
  ADD CONSTRAINT lodge_knowledge_source_type_check CHECK (source_type IN (
    'event', 'announcement', 'summons', 'document', 'history', 'member', 'help',
    'district_lodge', 'district_summons', 'district_event',
    'grand_lodge_page', 'district_page', 'external_lodge_page'
  ));

ALTER TABLE public.lodge_knowledge
  DROP CONSTRAINT IF EXISTS lodge_knowledge_source_url_check;
ALTER TABLE public.lodge_knowledge
  ADD CONSTRAINT lodge_knowledge_source_url_check CHECK (
    source_url LIKE '/%'
    OR (source_url ~ '^https://[^[:space:]]+$' AND length(source_url) <= 2000)
  );

CREATE OR REPLACE FUNCTION carletonlodge_private.sync_trusted_knowledge_page()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  source_row public.trusted_knowledge_sources%ROWTYPE;
  target_source_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.source_id ELSE NEW.source_id END;
  target_page_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  knowledge_type text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lodge_knowledge
    WHERE source_id = target_page_id
      AND source_type IN ('grand_lodge_page', 'district_page', 'external_lodge_page');
    RETURN OLD;
  END IF;

  SELECT * INTO source_row
  FROM public.trusted_knowledge_sources
  WHERE id = target_source_id;

  IF NOT FOUND OR source_row.enabled IS NOT TRUE THEN
    DELETE FROM public.lodge_knowledge
    WHERE source_id = target_page_id
      AND source_type IN ('grand_lodge_page', 'district_page', 'external_lodge_page');
    RETURN NEW;
  END IF;

  knowledge_type := CASE source_row.authority
    WHEN 'grand_lodge' THEN 'grand_lodge_page'
    WHEN 'lodge' THEN 'external_lodge_page'
    ELSE 'district_page'
  END;

  INSERT INTO public.lodge_knowledge (
    source_type, source_id, title, body, keywords, source_url, visibility,
    source_updated_at
  ) VALUES (
    knowledge_type,
    NEW.id,
    NEW.title,
    carletonlodge_private.knowledge_plain_text(NEW.clean_text),
    concat_ws(' ', source_row.name, source_row.authority, source_row.district_name,
      'official trusted external Masonic source'),
    NEW.canonical_url,
    'members',
    NEW.fetched_at
  )
  ON CONFLICT (source_type, source_id) DO UPDATE SET
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    keywords = EXCLUDED.keywords,
    source_url = EXCLUDED.source_url,
    visibility = EXCLUDED.visibility,
    source_updated_at = EXCLUDED.source_updated_at,
    updated_at = now();

  DELETE FROM public.lodge_knowledge
  WHERE source_id = NEW.id
    AND source_type IN ('grand_lodge_page', 'district_page', 'external_lodge_page')
    AND source_type <> knowledge_type;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION carletonlodge_private.sync_trusted_source_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.enabled IS NOT TRUE THEN
    DELETE FROM public.lodge_knowledge AS knowledge
    USING public.trusted_knowledge_pages AS page
    WHERE page.source_id = NEW.id
      AND knowledge.source_id = page.id
      AND knowledge.source_type IN ('grand_lodge_page', 'district_page', 'external_lodge_page');
  ELSIF OLD.enabled IS DISTINCT FROM NEW.enabled
    OR OLD.authority IS DISTINCT FROM NEW.authority
    OR OLD.name IS DISTINCT FROM NEW.name
    OR OLD.district_name IS DISTINCT FROM NEW.district_name THEN
    UPDATE public.trusted_knowledge_pages SET updated_at = now()
    WHERE source_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge_private.sync_trusted_knowledge_page()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION carletonlodge_private.sync_trusted_source_state()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER sync_trusted_knowledge_page
  AFTER INSERT OR UPDATE OR DELETE ON public.trusted_knowledge_pages
  FOR EACH ROW EXECUTE FUNCTION carletonlodge_private.sync_trusted_knowledge_page();
CREATE TRIGGER sync_trusted_source_state
  AFTER UPDATE OF enabled, authority, name, district_name
  ON public.trusted_knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION carletonlodge_private.sync_trusted_source_state();

-- The existing district tables are intentionally generalized instead of
-- creating a second, incompatible Ottawa District 2 data silo.
ALTER TABLE public.district_lodges
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.district_events
  ALTER COLUMN lodge_id DROP NOT NULL,
  ALTER COLUMN summons_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS district_name text NOT NULL DEFAULT 'Ottawa District 1',
  ADD COLUMN IF NOT EXISTS trusted_source_id uuid
    REFERENCES public.trusted_knowledge_sources(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS external_uid text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_checked_at timestamptz;

ALTER TABLE public.district_events
  ADD CONSTRAINT district_events_district_name_check CHECK (
    district_name IN ('Ottawa District 1', 'Ottawa District 2')
  ),
  ADD CONSTRAINT district_events_source_url_check CHECK (
    source_url IS NULL OR source_url ~ '^https://[^[:space:]]+$'
  );

CREATE UNIQUE INDEX district_events_external_occurrence_idx
  ON public.district_events(trusted_source_id, external_uid, event_date, event_time);
CREATE INDEX district_events_district_upcoming_idx
  ON public.district_events(district_name, event_date, event_time);

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
      NEW.website_url, NEW.details_as_of::text, array_to_string(NEW.aliases, ' ')
    )),
    concat_ws(' ', NEW.district_name, 'visiting lodge officer master secretary contact',
      NEW.name, NEW.lodge_number, array_to_string(NEW.aliases, ' ')),
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
DECLARE lodge_name text; source_district text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lodge_knowledge
    WHERE source_type = 'district_summons' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  SELECT name, district_name INTO lodge_name, source_district
  FROM public.district_lodges WHERE id = NEW.lodge_id;
  INSERT INTO public.lodge_knowledge (
    source_type, source_id, title, body, keywords, source_url, visibility, source_updated_at
  ) VALUES (
    'district_summons', NEW.id, NEW.title,
    carletonlodge_private.knowledge_plain_text(concat_ws(' ', lodge_name, source_district,
      NEW.issue_label, NEW.issue_date::text, NEW.content)),
    concat_ws(' ', source_district, 'visiting lodge summons notice agenda', lodge_name),
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
      NEW.source_checked_at::text
    )),
    concat_ws(' ', NEW.district_name, 'visiting lodge event meeting degree',
      lodge_name, NEW.degree, NEW.event_kind),
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

-- Seed the official district rosters. Officer names remain blank unless an
-- approved summons or current official source supplies them.
INSERT INTO public.district_lodges
  (district_name, name, lodge_number, slug, location, website_url, aliases)
VALUES
  ('Ottawa District 1', 'Acacia Lodge', '561', 'acacia-lodge-561', '3494 McBean Street, Richmond, Ontario', 'https://acacialodge.ca/', ARRAY['Acacia']),
  ('Ottawa District 1', 'Carleton Lodge', '465', 'carleton-lodge-465', '3704 Carp Road, Carp, Ontario', 'https://carpmasons.ca/', ARRAY['Carleton']),
  ('Ottawa District 1', 'Civil Service Lodge', '148', 'civil-service-lodge-148', '2140 Walkley Road, Ottawa, Ontario', 'https://csl148.ca/', ARRAY['Civil Service']),
  ('Ottawa District 1', 'Doric Lodge', '58', 'doric-lodge-58', '2140 Walkley Road, Ottawa, Ontario', 'https://www.doric58.ca/', ARRAY['Doric']),
  ('Ottawa District 1', 'Edinburgh Defenders Lodge', '590', 'edinburgh-defenders-lodge-590', '2140 Walkley Road, Ottawa, Ontario', 'https://www.edl590.ca/', ARRAY['Defenders', 'EDL']),
  ('Ottawa District 1', 'Goodwood Lodge', '159', 'goodwood-lodge-159', '3494 McBean Street, Richmond, Ontario', 'https://goodwood159.ca/', ARRAY['Goodwood']),
  ('Ottawa District 1', 'Hazeldean Lodge', '517', 'hazeldean-lodge-517', '21 Young Road, Kanata, Ontario', 'https://hazeldeanlodge.ca/', ARRAY['Hazeldean']),
  ('Ottawa District 1', 'Lodge of Fidelity', '231', 'lodge-of-fidelity-231', '2140 Walkley Road, Ottawa, Ontario', 'https://www.lodgeoffidelity.com/', ARRAY['Fidelity']),
  ('Ottawa District 1', 'Mississippi Lodge', '147', 'mississippi-lodge-147', '34 Mill Street, Almonte, Ontario', NULL, ARRAY['Mississippi']),
  ('Ottawa District 1', 'Prince of Wales Lodge', '371', 'prince-of-wales-lodge-371', '2140 Walkley Road, Ottawa, Ontario', 'https://pow371.ca/', ARRAY['Prince of Wales', 'PoW']),
  ('Ottawa District 1', 'Russell Lodge', '479', 'russell-lodge-479', '1129 Concession Street, Russell, Ontario', 'https://www.russelllodge.ca/', ARRAY['Russell']),
  ('Ottawa District 1', 'Sidney Albert Luke Lodge', '558', 'sidney-albert-luke-lodge-558', '2140 Walkley Road, Ottawa, Ontario', NULL, ARRAY['Sidney Albert Luke', 'SAL']),
  ('Ottawa District 1', 'St. Andrew''s Lodge', '560', 'st-andrews-lodge-560', '2140 Walkley Road, Ottawa, Ontario', 'https://www.standrews560.com/', ARRAY['St Andrews', 'St Andrew''s']),
  ('Ottawa District 1', 'St. John''s Lodge', '63', 'st-johns-lodge-63', '55 Bridge Street, Carleton Place, Ontario', 'https://www.stjohns63.ca/', ARRAY['St Johns', 'St John''s']),
  ('Ottawa District 1', 'Temple Lodge', '665', 'temple-lodge-665', '430 Churchill Avenue, Ottawa, Ontario', 'https://www.temple665.com/', ARRAY['Temple']),
  ('Ottawa District 2', 'Ashlar Lodge', '564', 'ashlar-lodge-564', '2140 Walkley Road, Ottawa, Ontario', 'https://ashlarlodge564.ca/', ARRAY['Ashlar']),
  ('Ottawa District 2', 'Bytown Lodge', '721', 'bytown-lodge-721', '430 Churchill Avenue North, Ottawa, Ontario', 'https://www.bytownlodge721.com/', ARRAY['Bytown']),
  ('Ottawa District 2', 'Cobden Lodge', '459', 'cobden-lodge-459', '15 Astrolabe Road, Cobden, Ontario', NULL, ARRAY['Cobden']),
  ('Ottawa District 2', 'Ionic Lodge', '526', 'ionic-lodge-526', '430 Churchill Avenue North, Ottawa, Ontario', 'https://ioniclodge526.com/', ARRAY['Ionic']),
  ('Ottawa District 2', 'Madawaska Lodge', '196', 'madawaska-lodge-196', '31 James Street, Arnprior, Ontario', 'https://madawaskalodge196.ca/', ARRAY['Madawaska']),
  ('Ottawa District 2', 'Pembroke Lodge', '128', 'pembroke-lodge-128', '222 Dickson Street, Pembroke, Ontario', NULL, ARRAY['Pembroke']),
  ('Ottawa District 2', 'Renfrew Lodge', '122', 'renfrew-lodge-122', '340 Raglan Street South, Renfrew, Ontario', 'https://www.renfrew122.ca/', ARRAY['Renfrew']),
  ('Ottawa District 2', 'The Builders'' Lodge', '177', 'the-builders-lodge-177', '2140 Walkley Road, Ottawa, Ontario', 'https://thebuilderslodge.org/', ARRAY['Builders', 'The Builders'])
ON CONFLICT (name) DO UPDATE SET
  district_name = EXCLUDED.district_name,
  lodge_number = EXCLUDED.lodge_number,
  location = EXCLUDED.location,
  website_url = EXCLUDED.website_url,
  aliases = EXCLUDED.aliases,
  updated_at = now();

INSERT INTO public.trusted_knowledge_sources
  (name, authority, district_name, source_kind, source_url, domain,
   allow_live_search, refresh_interval_minutes)
VALUES
  ('Grand Lodge of Ontario', 'grand_lodge', NULL, 'page', 'https://ontariomasons.ca/', 'ontariomasons.ca', true, 1440),
  ('Grand Lodge district directory', 'grand_lodge', NULL, 'page', 'https://ontariomasons.ca/our-districts/', 'ontariomasons.ca', true, 1440),
  ('Ottawa District 1', 'district_1', 'Ottawa District 1', 'page', 'https://www.ottawadistrict1masons.ca/', 'ottawadistrict1masons.ca', true, 720),
  ('Ottawa District 1 lodge directory', 'district_1', 'Ottawa District 1', 'page', 'https://www.ottawadistrict1masons.ca/district/lodges', 'ottawadistrict1masons.ca', true, 720),
  ('Ottawa District 1 calendar page', 'district_1', 'Ottawa District 1', 'page', 'https://www.ottawadistrict1masons.ca/events/calendar', 'ottawadistrict1masons.ca', true, 180),
  ('Ottawa District 1 official calendar', 'district_1', 'Ottawa District 1', 'calendar_ics', 'https://calendar.google.com/calendar/ical/ottawadistrict1masons%40gmail.com/public/basic.ics', 'calendar.google.com', false, 120),
  ('Ottawa District 2', 'district_2', 'Ottawa District 2', 'page', 'https://www.ottawamasons.ca/', 'ottawamasons.ca', true, 720),
  ('Ottawa District 2 lodge directory', 'district_2', 'Ottawa District 2', 'page', 'https://www.ottawamasons.ca/directory/', 'ottawamasons.ca', true, 720),
  ('Ottawa District 2 calendar page', 'district_2', 'Ottawa District 2', 'page', 'https://www.ottawamasons.ca/events-calendar/', 'ottawamasons.ca', true, 180),
  ('Ottawa District 2 official calendar', 'district_2', 'Ottawa District 2', 'calendar_ics', 'https://calendar.google.com/calendar/ical/faf2ecc555a3f42fcbf6a9b9868d2cbe210b5c296c7107b19c0acab0294f92a1%40group.calendar.google.com/public/basic.ics', 'calendar.google.com', false, 120),
  ('Acacia Lodge No. 561', 'lodge', 'Ottawa District 1', 'page', 'https://acacialodge.ca/', 'acacialodge.ca', true, 1440),
  ('Civil Service Lodge No. 148', 'lodge', 'Ottawa District 1', 'page', 'https://csl148.ca/', 'csl148.ca', true, 1440),
  ('Doric Lodge No. 58', 'lodge', 'Ottawa District 1', 'page', 'https://www.doric58.ca/', 'doric58.ca', true, 1440),
  ('Edinburgh Defenders Lodge No. 590', 'lodge', 'Ottawa District 1', 'page', 'https://www.edl590.ca/', 'edl590.ca', true, 1440),
  ('Goodwood Lodge No. 159', 'lodge', 'Ottawa District 1', 'page', 'https://goodwood159.ca/', 'goodwood159.ca', true, 1440),
  ('Hazeldean Lodge No. 517', 'lodge', 'Ottawa District 1', 'page', 'https://hazeldeanlodge.ca/', 'hazeldeanlodge.ca', true, 1440),
  ('Lodge of Fidelity No. 231', 'lodge', 'Ottawa District 1', 'page', 'https://www.lodgeoffidelity.com/', 'lodgeoffidelity.com', true, 1440),
  ('Prince of Wales Lodge No. 371', 'lodge', 'Ottawa District 1', 'page', 'https://pow371.ca/', 'pow371.ca', true, 1440),
  ('Russell Lodge No. 479', 'lodge', 'Ottawa District 1', 'page', 'https://www.russelllodge.ca/', 'russelllodge.ca', true, 1440),
  ('St. Andrew''s Lodge No. 560', 'lodge', 'Ottawa District 1', 'page', 'https://www.standrews560.com/', 'standrews560.com', true, 1440),
  ('St. John''s Lodge No. 63', 'lodge', 'Ottawa District 1', 'page', 'https://www.stjohns63.ca/', 'stjohns63.ca', true, 1440),
  ('Temple Lodge No. 665', 'lodge', 'Ottawa District 1', 'page', 'https://www.temple665.com/', 'temple665.com', true, 1440),
  ('Ashlar Lodge No. 564', 'lodge', 'Ottawa District 2', 'page', 'https://ashlarlodge564.ca/', 'ashlarlodge564.ca', true, 1440),
  ('Bytown Lodge No. 721', 'lodge', 'Ottawa District 2', 'page', 'https://www.bytownlodge721.com/', 'bytownlodge721.com', true, 1440),
  ('Ionic Lodge No. 526', 'lodge', 'Ottawa District 2', 'page', 'https://ioniclodge526.com/', 'ioniclodge526.com', true, 1440),
  ('Madawaska Lodge No. 196', 'lodge', 'Ottawa District 2', 'page', 'https://madawaskalodge196.ca/', 'madawaskalodge196.ca', true, 1440),
  ('Renfrew Lodge No. 122', 'lodge', 'Ottawa District 2', 'page', 'https://www.renfrew122.ca/', 'renfrew122.ca', true, 1440),
  ('The Builders'' Lodge No. 177', 'lodge', 'Ottawa District 2', 'page', 'https://thebuilderslodge.org/', 'thebuilderslodge.org', true, 1440)
ON CONFLICT (source_url) DO UPDATE SET
  name = EXCLUDED.name,
  authority = EXCLUDED.authority,
  district_name = EXCLUDED.district_name,
  source_kind = EXCLUDED.source_kind,
  domain = EXCLUDED.domain,
  allow_live_search = EXCLUDED.allow_live_search,
  refresh_interval_minutes = EXCLUDED.refresh_interval_minutes,
  updated_at = now();

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'carletonlodge-refresh-trusted-sources') THEN
    PERFORM cron.unschedule('carletonlodge-refresh-trusted-sources');
  END IF;
END;
$$;

SELECT cron.schedule(
  'carletonlodge-refresh-trusted-sources',
  '17 */2 * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://isnxsygngysxgzeuhmjm.supabase.co/functions/v1/refresh-trusted-sources',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'carletonlodge_trusted_source_cron'
        )
      ),
      body := jsonb_build_object('scheduled', true, 'limit', 4),
      timeout_milliseconds := 120000
    ) AS request_id;
  $cron$
);
