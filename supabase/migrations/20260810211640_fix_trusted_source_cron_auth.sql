-- Use a dedicated shared secret for the scheduled trusted-source refresh.
-- Edge Function service-role tokens are managed separately from Vault, so the
-- scheduler and function authenticate with a narrowly scoped shared secret.

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
