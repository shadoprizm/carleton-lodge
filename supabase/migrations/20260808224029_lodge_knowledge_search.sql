-- One permission-aware search index powers site search and the future
-- citation-first Ask Carleton assistant. Source records remain authoritative.

CREATE TABLE IF NOT EXISTS public.help_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (length(btrim(category)) BETWEEN 1 AND 80),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 10000),
  keywords text[] NOT NULL DEFAULT '{}',
  url text NOT NULL CHECK (url LIKE '/%'),
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'members')),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.help_topics ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_help_topics_updated_at ON public.help_topics;
CREATE TRIGGER update_help_topics_updated_at
  BEFORE UPDATE ON public.help_topics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT ON public.help_topics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_topics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_topics TO service_role;

CREATE POLICY "Public can view public help topics"
  ON public.help_topics FOR SELECT TO anon
  USING (visibility = 'public');

CREATE POLICY "Members can view help topics"
  ON public.help_topics FOR SELECT TO authenticated
  USING (visibility IN ('public', 'members'));

CREATE POLICY "Library editors can create help topics"
  ON public.help_topics FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_section_permission('library', 'write'));

CREATE POLICY "Library editors can update help topics"
  ON public.help_topics FOR UPDATE TO authenticated
  USING (public.has_admin_section_permission('library', 'write'))
  WITH CHECK (public.has_admin_section_permission('library', 'write'));

CREATE POLICY "Library editors can delete help topics"
  ON public.help_topics FOR DELETE TO authenticated
  USING (public.has_admin_section_permission('library', 'write'));

INSERT INTO public.help_topics (category, title, body, keywords, url, visibility, display_order)
VALUES
  ('Website help', 'How do I sign in?', 'Choose Member Login at the top of the website. Enter your lodge account email and password, or choose the one-time email link. If you do not have an account or the email does not arrive, use the help email shown in the sign-in window.', ARRAY['login', 'sign in', 'password', 'account', 'magic link'], '/my-lodge', 'public', 10),
  ('Calendar', 'Where do I find current meeting and event information?', 'Open the Lodge Calendar for the current date, time, location, directions, cancellations, and postponements. The list view is the easiest place to start. You can also download any event to your personal calendar.', ARRAY['meeting', 'event', 'date', 'time', 'location', 'directions', 'cancelled'], '/calendar', 'public', 20),
  ('Member information', 'Where do I read the latest summons?', 'Sign in, then choose My Lodge or Summons. The newest summons appears first and older issues remain available for reference.', ARRAY['summons', 'notice', 'monthly', 'agenda'], '/summons', 'members', 30),
  ('Member information', 'Where do I find lodge forms and documents?', 'Sign in and open the Lodge Library. You can search by title, description, filename, or tag, then preview or download the document.', ARRAY['form', 'document', 'minutes', 'download', 'library', 'file'], '/library', 'members', 40),
  ('Member information', 'How do I find an officer or lodge member?', 'Sign in and open Officers & Members from My Lodge. The directory only shows entries approved for member viewing. Contact the Secretary if your own information needs to be corrected.', ARRAY['officer', 'secretary', 'member', 'phone', 'email', 'directory'], '/members', 'members', 50),
  ('Notifications', 'How do I change email notifications?', 'After signing in, choose the bell in the top navigation. You can turn lodge email on or off and choose announcements, summons, new events, and event changes separately.', ARRAY['email', 'notification', 'alert', 'preference', 'unsubscribe'], '/my-lodge', 'members', 60),
  ('Website help', 'What should I do if information looks wrong or is missing?', 'Use the contact information on the website and describe what needs to be corrected. For urgent event changes, contact the event organizer or Lodge Secretary. The website should be treated as the current source once the correction is published.', ARRAY['wrong', 'missing', 'correction', 'help', 'support'], '/#contact', 'public', 70)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.lodge_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type IN (
    'event',
    'announcement',
    'summons',
    'document',
    'history',
    'member',
    'help'
  )),
  source_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  keywords text NOT NULL DEFAULT '',
  source_url text NOT NULL CHECK (source_url LIKE '/%'),
  visibility text NOT NULL CHECK (visibility IN ('public', 'members', 'admin')),
  valid_until timestamptz,
  source_updated_at timestamptz NOT NULL DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(body, '')), 'B')
    || setweight(to_tsvector('simple', coalesce(keywords, '')), 'C')
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lodge_knowledge_source_unique UNIQUE (source_type, source_id)
);

ALTER TABLE public.lodge_knowledge ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS lodge_knowledge_search_idx
  ON public.lodge_knowledge USING gin(search_vector);
CREATE INDEX IF NOT EXISTS lodge_knowledge_source_idx
  ON public.lodge_knowledge(source_type, source_updated_at DESC);

GRANT SELECT ON public.lodge_knowledge TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lodge_knowledge TO service_role;

CREATE POLICY "Public can search public lodge knowledge"
  ON public.lodge_knowledge FOR SELECT TO anon
  USING (
    visibility = 'public'
    AND (valid_until IS NULL OR valid_until > now())
  );

CREATE POLICY "Members can search lodge knowledge"
  ON public.lodge_knowledge FOR SELECT TO authenticated
  USING (
    visibility IN ('public', 'members')
    AND (valid_until IS NULL OR valid_until > now())
  );

CREATE POLICY "Full administrators can search administrative knowledge"
  ON public.lodge_knowledge FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION carletonlodge_private.knowledge_plain_text(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT btrim(regexp_replace(regexp_replace(coalesce(value, ''), '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g'));
$$;

REVOKE ALL ON FUNCTION carletonlodge_private.knowledge_plain_text(text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.search_lodge_knowledge(
  search_query text,
  result_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  source_type text,
  source_id uuid,
  title text,
  snippet text,
  source_url text,
  visibility text,
  source_updated_at timestamptz,
  rank real
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = pg_catalog, public
AS $$
  WITH query AS (
    SELECT websearch_to_tsquery('english', btrim(search_query)) AS value
  )
  SELECT
    knowledge.id,
    knowledge.source_type,
    knowledge.source_id,
    knowledge.title,
    left(knowledge.body, 360) AS snippet,
    knowledge.source_url,
    knowledge.visibility,
    knowledge.source_updated_at,
    ts_rank_cd(knowledge.search_vector, query.value, 32) AS rank
  FROM public.lodge_knowledge AS knowledge
  CROSS JOIN query
  WHERE length(btrim(search_query)) > 0
    AND knowledge.search_vector @@ query.value
  ORDER BY rank DESC, knowledge.source_updated_at DESC
  LIMIT LEAST(GREATEST(result_limit, 1), 50);
$$;

REVOKE ALL ON FUNCTION public.search_lodge_knowledge(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_lodge_knowledge(text, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION carletonlodge_private.sync_event_knowledge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lodge_knowledge WHERE source_type = 'event' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO public.lodge_knowledge (source_type, source_id, title, body, keywords, source_url, visibility, source_updated_at)
  VALUES (
    'event', NEW.id, NEW.title,
    carletonlodge_private.knowledge_plain_text(concat_ws(' ', NEW.description, NEW.event_date::text, NEW.event_time::text, NEW.location, NEW.location_address, NEW.event_status, NEW.status_note)),
    'calendar meeting event date time location cancellation postponement',
    '/calendar', NEW.visibility, NEW.updated_at
  )
  ON CONFLICT (source_type, source_id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, keywords = EXCLUDED.keywords, source_url = EXCLUDED.source_url, visibility = EXCLUDED.visibility, source_updated_at = EXCLUDED.source_updated_at, updated_at = now();
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
  IF NEW.is_published = false THEN
    DELETE FROM public.lodge_knowledge WHERE source_type = 'announcement' AND source_id = NEW.id;
    RETURN NEW;
  END IF;
  INSERT INTO public.lodge_knowledge (source_type, source_id, title, body, keywords, source_url, visibility, valid_until, source_updated_at)
  VALUES ('announcement', NEW.id, NEW.title, carletonlodge_private.knowledge_plain_text(NEW.body), NEW.priority || ' notice announcement', CASE WHEN NEW.visibility = 'members' THEN '/my-lodge' ELSE '/' END, NEW.visibility, NEW.expires_at, NEW.updated_at)
  ON CONFLICT (source_type, source_id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, keywords = EXCLUDED.keywords, source_url = EXCLUDED.source_url, visibility = EXCLUDED.visibility, valid_until = EXCLUDED.valid_until, source_updated_at = EXCLUDED.source_updated_at, updated_at = now();
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
  INSERT INTO public.lodge_knowledge (source_type, source_id, title, body, keywords, source_url, visibility, source_updated_at)
  VALUES ('summons', NEW.id, NEW.title, carletonlodge_private.knowledge_plain_text(NEW.month || ' ' || NEW.content), 'summons monthly notice agenda', '/summons', 'members', NEW.updated_at)
  ON CONFLICT (source_type, source_id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, source_updated_at = EXCLUDED.source_updated_at, updated_at = now();
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
  INSERT INTO public.lodge_knowledge (source_type, source_id, title, body, keywords, source_url, visibility, source_updated_at)
  VALUES ('document', NEW.id, NEW.title, carletonlodge_private.knowledge_plain_text(concat_ws(' ', NEW.description, NEW.file_name)), array_to_string(NEW.tags, ' '), '/library', 'members', NEW.updated_at)
  ON CONFLICT (source_type, source_id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, keywords = EXCLUDED.keywords, source_updated_at = EXCLUDED.source_updated_at, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION carletonlodge_private.sync_history_era_knowledge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lodge_knowledge WHERE source_type = 'history' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO public.lodge_knowledge (source_type, source_id, title, body, keywords, source_url, visibility, source_updated_at)
  VALUES ('history', NEW.id, NEW.title, carletonlodge_private.knowledge_plain_text(concat_ws(' ', NEW.year_start::text, NEW.year_end::text, NEW.summary, NEW.content)), 'history heritage timeline', '/history/' || NEW.slug, 'public', NEW.updated_at)
  ON CONFLICT (source_type, source_id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, source_url = EXCLUDED.source_url, source_updated_at = EXCLUDED.source_updated_at, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION carletonlodge_private.sync_member_knowledge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE position_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lodge_knowledge WHERE source_type = 'member' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  SELECT name INTO position_name FROM public.lodge_positions WHERE id = NEW.position_id;
  INSERT INTO public.lodge_knowledge (source_type, source_id, title, body, keywords, source_url, visibility, source_updated_at)
  VALUES ('member', NEW.id, NEW.full_name, carletonlodge_private.knowledge_plain_text(concat_ws(' ', position_name, NEW.bio)), concat_ws(' ', 'member officer directory', position_name), '/members', CASE WHEN NEW.visible_to_members THEN 'members' ELSE 'admin' END, NEW.updated_at)
  ON CONFLICT (source_type, source_id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, keywords = EXCLUDED.keywords, visibility = EXCLUDED.visibility, source_updated_at = EXCLUDED.source_updated_at, updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION carletonlodge_private.sync_help_knowledge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lodge_knowledge WHERE source_type = 'help' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO public.lodge_knowledge (source_type, source_id, title, body, keywords, source_url, visibility, source_updated_at)
  VALUES ('help', NEW.id, NEW.title, carletonlodge_private.knowledge_plain_text(NEW.body), array_to_string(NEW.keywords, ' '), NEW.url, NEW.visibility, NEW.updated_at)
  ON CONFLICT (source_type, source_id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, keywords = EXCLUDED.keywords, source_url = EXCLUDED.source_url, visibility = EXCLUDED.visibility, source_updated_at = EXCLUDED.source_updated_at, updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge_private.sync_event_knowledge() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION carletonlodge_private.sync_announcement_knowledge() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION carletonlodge_private.sync_summons_knowledge() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION carletonlodge_private.sync_document_knowledge() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION carletonlodge_private.sync_history_era_knowledge() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION carletonlodge_private.sync_member_knowledge() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION carletonlodge_private.sync_help_knowledge() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER sync_event_knowledge AFTER INSERT OR UPDATE OR DELETE ON public.events FOR EACH ROW EXECUTE FUNCTION carletonlodge_private.sync_event_knowledge();
CREATE TRIGGER sync_announcement_knowledge AFTER INSERT OR UPDATE OR DELETE ON public.announcements FOR EACH ROW EXECUTE FUNCTION carletonlodge_private.sync_announcement_knowledge();
CREATE TRIGGER sync_summons_knowledge AFTER INSERT OR UPDATE OR DELETE ON public.summons FOR EACH ROW EXECUTE FUNCTION carletonlodge_private.sync_summons_knowledge();
CREATE TRIGGER sync_document_knowledge AFTER INSERT OR UPDATE OR DELETE ON public.documents FOR EACH ROW EXECUTE FUNCTION carletonlodge_private.sync_document_knowledge();
CREATE TRIGGER sync_history_era_knowledge AFTER INSERT OR UPDATE OR DELETE ON public.history_eras FOR EACH ROW EXECUTE FUNCTION carletonlodge_private.sync_history_era_knowledge();
CREATE TRIGGER sync_member_knowledge AFTER INSERT OR UPDATE OR DELETE ON public.lodge_members FOR EACH ROW EXECUTE FUNCTION carletonlodge_private.sync_member_knowledge();
CREATE TRIGGER sync_help_knowledge AFTER INSERT OR UPDATE OR DELETE ON public.help_topics FOR EACH ROW EXECUTE FUNCTION carletonlodge_private.sync_help_knowledge();

-- Backfill approved current sources.
INSERT INTO public.lodge_knowledge (source_type, source_id, title, body, keywords, source_url, visibility, source_updated_at)
SELECT 'event', id, title, carletonlodge_private.knowledge_plain_text(concat_ws(' ', description, event_date::text, event_time::text, location, location_address, event_status, status_note)), 'calendar meeting event date time location cancellation postponement', '/calendar', visibility, updated_at FROM public.events
ON CONFLICT (source_type, source_id) DO NOTHING;

INSERT INTO public.lodge_knowledge (source_type, source_id, title, body, keywords, source_url, visibility, valid_until, source_updated_at)
SELECT 'announcement', id, title, carletonlodge_private.knowledge_plain_text(body), priority || ' notice announcement', CASE WHEN visibility = 'members' THEN '/my-lodge' ELSE '/' END, visibility, expires_at, updated_at FROM public.announcements WHERE is_published = true
ON CONFLICT (source_type, source_id) DO NOTHING;

INSERT INTO public.lodge_knowledge (source_type, source_id, title, body, keywords, source_url, visibility, source_updated_at)
SELECT 'summons', id, title, carletonlodge_private.knowledge_plain_text(month || ' ' || content), 'summons monthly notice agenda', '/summons', 'members', updated_at FROM public.summons
ON CONFLICT (source_type, source_id) DO NOTHING;

INSERT INTO public.lodge_knowledge (source_type, source_id, title, body, keywords, source_url, visibility, source_updated_at)
SELECT 'document', id, title, carletonlodge_private.knowledge_plain_text(concat_ws(' ', description, file_name)), array_to_string(tags, ' '), '/library', 'members', updated_at FROM public.documents
ON CONFLICT (source_type, source_id) DO NOTHING;

INSERT INTO public.lodge_knowledge (source_type, source_id, title, body, keywords, source_url, visibility, source_updated_at)
SELECT 'history', id, title, carletonlodge_private.knowledge_plain_text(concat_ws(' ', year_start::text, year_end::text, summary, content)), 'history heritage timeline', '/history/' || slug, 'public', updated_at FROM public.history_eras
ON CONFLICT (source_type, source_id) DO NOTHING;

INSERT INTO public.lodge_knowledge (source_type, source_id, title, body, keywords, source_url, visibility, source_updated_at)
SELECT 'member', member.id, member.full_name, carletonlodge_private.knowledge_plain_text(concat_ws(' ', position.name, member.bio)), concat_ws(' ', 'member officer directory', position.name), '/members', CASE WHEN member.visible_to_members THEN 'members' ELSE 'admin' END, member.updated_at
FROM public.lodge_members AS member
LEFT JOIN public.lodge_positions AS position ON position.id = member.position_id
ON CONFLICT (source_type, source_id) DO NOTHING;

INSERT INTO public.lodge_knowledge (source_type, source_id, title, body, keywords, source_url, visibility, source_updated_at)
SELECT 'help', id, title, carletonlodge_private.knowledge_plain_text(body), array_to_string(keywords, ' '), url, visibility, updated_at FROM public.help_topics
ON CONFLICT (source_type, source_id) DO NOTHING;
