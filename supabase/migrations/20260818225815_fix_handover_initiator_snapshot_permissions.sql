/*
  Keep officer-mailbox handover history writable without granting the
  service_role access to Supabase's protected auth.users table.

  The Edge Function supplies the verified actor email for new handovers. The
  public profile lookup keeps the trigger backward-compatible during the
  migration/function deployment window and for other trusted service-role
  callers.
*/

CREATE OR REPLACE FUNCTION public.populate_handover_initiator_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.initiated_by_email_snapshot = NULLIF(
    btrim(NEW.initiated_by_email_snapshot),
    ''
  );

  IF NEW.initiated_by IS NOT NULL
    AND NEW.initiated_by_email_snapshot IS NULL
  THEN
    SELECT COALESCE(NULLIF(btrim(profile.email), ''), '[not recorded]')
    INTO NEW.initiated_by_email_snapshot
    FROM public.profiles AS profile
    WHERE profile.id = NEW.initiated_by;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Handover initiator could not be resolved';
    END IF;
  END IF;

  NEW.initiated_by_email_snapshot = COALESCE(
    NEW.initiated_by_email_snapshot,
    '[not recorded]'
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.populate_handover_initiator_snapshot() IS
  'Preserves the handover initiator email without reading the protected auth.users table.';
