-- When all meaningful terms match at least one source, show only those complete
-- matches. Use the broader any-term search solely as a zero-result fallback.
CREATE OR REPLACE FUNCTION carletonlodge.search_lodge_knowledge(
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
SET search_path = pg_catalog, carletonlodge
AS $$
  WITH lexemes AS (
    SELECT tsvector_to_array(to_tsvector('english', btrim(search_query))) AS value
  ),
  query AS (
    SELECT
      websearch_to_tsquery('english', btrim(search_query)) AS exact_value,
      CASE
        WHEN array_length(lexemes.value, 1) > 0
          THEN to_tsquery('english', array_to_string(lexemes.value, ' | '))
        ELSE NULL::tsquery
      END AS any_value
    FROM lexemes
  ),
  match_state AS (
    SELECT EXISTS (
      SELECT 1
      FROM carletonlodge.lodge_knowledge AS candidate
      CROSS JOIN query
      WHERE candidate.search_vector @@ query.exact_value
    ) AS has_exact_match
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
    (
      CASE WHEN knowledge.search_vector @@ query.exact_value THEN 1 ELSE 0 END
      + ts_rank_cd(knowledge.search_vector, query.exact_value, 32)
      + 0.25 * coalesce(ts_rank_cd(knowledge.search_vector, query.any_value, 32), 0)
    )::real AS rank
  FROM carletonlodge.lodge_knowledge AS knowledge
  CROSS JOIN query
  CROSS JOIN match_state
  WHERE length(btrim(search_query)) > 0
    AND (
      knowledge.search_vector @@ query.exact_value
      OR (
        NOT match_state.has_exact_match
        AND knowledge.search_vector @@ query.any_value
      )
    )
  ORDER BY rank DESC, knowledge.source_updated_at DESC
  LIMIT LEAST(GREATEST(result_limit, 1), 50);
$$;

REVOKE ALL ON FUNCTION carletonlodge.search_lodge_knowledge(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION carletonlodge.search_lodge_knowledge(text, integer) TO anon, authenticated;

-- Search is for current operational information. Historical lodge events remain
-- in the events table but leave the knowledge index after their Toronto date.
CREATE OR REPLACE FUNCTION carletonlodge_private.sync_event_knowledge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, carletonlodge
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM carletonlodge.lodge_knowledge WHERE source_type = 'event' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO carletonlodge.lodge_knowledge (source_type, source_id, title, body, keywords, source_url, visibility, valid_until, source_updated_at)
  VALUES (
    'event', NEW.id, NEW.title,
    carletonlodge_private.knowledge_plain_text(concat_ws(' ', NEW.description, NEW.event_date::text, NEW.event_time::text, NEW.location, NEW.location_address, NEW.event_status, NEW.status_note)),
    'calendar meeting event date time location cancellation postponement',
    '/calendar', NEW.visibility,
    ((NEW.event_date + 1)::timestamp AT TIME ZONE 'America/Toronto'),
    NEW.updated_at
  )
  ON CONFLICT (source_type, source_id) DO UPDATE SET
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    keywords = EXCLUDED.keywords,
    source_url = EXCLUDED.source_url,
    visibility = EXCLUDED.visibility,
    valid_until = EXCLUDED.valid_until,
    source_updated_at = EXCLUDED.source_updated_at,
    updated_at = now();
  RETURN NEW;
END;
$$;

UPDATE carletonlodge.lodge_knowledge AS knowledge
SET valid_until = ((event.event_date + 1)::timestamp AT TIME ZONE 'America/Toronto'),
    updated_at = now()
FROM carletonlodge.events AS event
WHERE knowledge.source_type = 'event'
  AND knowledge.source_id = event.id;
