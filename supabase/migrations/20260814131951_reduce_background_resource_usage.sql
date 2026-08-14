/*
  Reduce background Supabase usage without changing the underlying workflows.

  - Queue processors now use a five-minute fallback cadence.
  - Cron run history is retained for seven days and pruned daily.
  - Trusted sources that were still failing at deployment time are disabled;
    their cached knowledge remains available until an administrator removes it.

  The notification cron is environment-scoped, so a missing job is tolerated.
*/

DO $$
DECLARE
  target_job_id bigint;
BEGIN
  SELECT jobid
  INTO target_job_id
  FROM cron.job
  WHERE jobname = 'carletonlodge-process-notifications';

  IF target_job_id IS NOT NULL THEN
    PERFORM cron.alter_job(
      job_id := target_job_id,
      schedule := '*/5 * * * *'
    );
  ELSE
    RAISE NOTICE 'carletonlodge-process-notifications is not configured in this environment';
  END IF;

  SELECT jobid
  INTO target_job_id
  FROM cron.job
  WHERE jobname = 'carletonlodge-process-mailroom';

  IF target_job_id IS NOT NULL THEN
    PERFORM cron.alter_job(
      job_id := target_job_id,
      schedule := '*/5 * * * *'
    );
  ELSE
    RAISE NOTICE 'carletonlodge-process-mailroom is not configured in this environment';
  END IF;
END;
$$;

DO $$
DECLARE
  cleanup_job_id bigint;
  cleanup_command text := $command$
    DELETE FROM cron.job_run_details
    WHERE end_time < now() - interval '7 days';
  $command$;
BEGIN
  SELECT jobid
  INTO cleanup_job_id
  FROM cron.job
  WHERE jobname = 'carletonlodge-prune-cron-history';

  IF cleanup_job_id IS NULL THEN
    PERFORM cron.schedule(
      'carletonlodge-prune-cron-history',
      '5 4 * * *',
      cleanup_command
    );
  ELSE
    PERFORM cron.alter_job(
      job_id := cleanup_job_id,
      schedule := '5 4 * * *',
      command := cleanup_command,
      active := true
    );
  END IF;
END;
$$;

DELETE FROM cron.job_run_details
WHERE end_time < now() - interval '7 days';

UPDATE public.trusted_knowledge_sources
SET
  enabled = false,
  updated_at = now()
WHERE id IN (
  'b6263c79-e4e9-4d16-9bb6-66f8e1e088e5'::uuid, -- Ottawa District 1 official calendar
  '7595555f-4e2c-4e98-b766-5f8c41daa2d3'::uuid, -- Ottawa District 2 official calendar
  '7f909da7-6d03-4dba-b7bc-5e23ad9da62e'::uuid, -- Bytown Lodge No. 721
  '0ce7f706-0ae7-48be-92c1-15909bc18e10'::uuid, -- Doric Lodge No. 58
  '689d4dea-b5eb-4e5e-afe9-8942bc653309'::uuid, -- Lodge of Fidelity No. 231
  '188f0405-c603-4f3f-b9ab-f579fd524e33'::uuid  -- St. Andrew's Lodge No. 560
)
AND enabled = true
AND consecutive_failures > 0;
