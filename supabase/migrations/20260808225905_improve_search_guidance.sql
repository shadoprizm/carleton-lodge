-- Keep exact phrase-style matches first, then fall back to any meaningful
-- search term so ordinary questions do not end in a misleading dead end.
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
  FROM public.lodge_knowledge AS knowledge
  CROSS JOIN query
  WHERE length(btrim(search_query)) > 0
    AND (
      knowledge.search_vector @@ query.exact_value
      OR knowledge.search_vector @@ query.any_value
    )
  ORDER BY rank DESC, knowledge.source_updated_at DESC
  LIMIT LEAST(GREATEST(result_limit, 1), 50);
$$;

REVOKE ALL ON FUNCTION public.search_lodge_knowledge(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_lodge_knowledge(text, integer) TO anon, authenticated;

UPDATE public.help_topics
SET keywords = keywords || ARRAY['next', 'upcoming']::text[]
WHERE title = 'Where do I find current meeting and event information?'
  AND NOT keywords @> ARRAY['next', 'upcoming']::text[];
