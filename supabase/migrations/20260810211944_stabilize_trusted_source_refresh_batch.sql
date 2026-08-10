-- Keep scheduled refreshes within the Edge worker resource envelope. The job
-- runs every two hours and selects the least-recently checked sources first,
-- so four sources per run comfortably covers the full catalogue each day.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'carletonlodge-refresh-trusted-sources'
  ) THEN
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
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'carletonlodge_trusted_source_cron'
        )
      ),
      body := jsonb_build_object('scheduled', true, 'limit', 4),
      timeout_milliseconds := 120000
    ) AS request_id;
  $cron$
);
