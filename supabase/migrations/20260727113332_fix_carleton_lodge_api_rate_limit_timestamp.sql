/*
  Correct a PL/pgSQL variable name that collided with the SQL CURRENT_TIME
  keyword, and make the browser-role denial explicit for the database linter.
*/

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
  request_time timestamptz := clock_timestamp();
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
    request_time,
    1,
    request_time
  )
  ON CONFLICT (scope, identifier_hash) DO UPDATE
  SET
    window_started_at = CASE
      WHEN limits.window_started_at <= request_time - make_interval(secs => window_seconds)
        THEN request_time
      ELSE limits.window_started_at
    END,
    request_count = CASE
      WHEN limits.window_started_at <= request_time - make_interval(secs => window_seconds)
        THEN 1
      ELSE limits.request_count + 1
    END,
    updated_at = request_time
  RETURNING request_count, window_started_at
  INTO current_count, current_window;

  RETURN QUERY SELECT
    current_count <= maximum_requests,
    GREATEST(maximum_requests - current_count, 0),
    CASE
      WHEN current_count <= maximum_requests THEN 0
      ELSE GREATEST(
        CEIL(EXTRACT(EPOCH FROM (
          current_window + make_interval(secs => window_seconds) - request_time
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

DROP POLICY IF EXISTS "Browser roles cannot access API rate limits"
  ON carletonlodge.api_rate_limits;
CREATE POLICY "Browser roles cannot access API rate limits"
  ON carletonlodge.api_rate_limits
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
