/*
  Every newly linked Lodge account must complete Carleton's password-safety
  flow, including the site-scoped breached-password check.
*/

CREATE OR REPLACE FUNCTION carletonlodge_private.handle_new_user_if_lodge_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, carletonlodge
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM carletonlodge.lodge_members
    WHERE lower(email) = lower(NEW.email)
  ) THEN
    INSERT INTO carletonlodge.profiles (
      id,
      email,
      is_admin,
      force_password_change,
      created_at
    )
    VALUES (NEW.id, NEW.email, false, true, now())
    ON CONFLICT (id) DO NOTHING;

    UPDATE carletonlodge.lodge_members
    SET linked_profile_id = NEW.id
    WHERE lower(email) = lower(NEW.email)
      AND linked_profile_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge_private.handle_new_user_if_lodge_member()
  FROM PUBLIC, anon, authenticated, service_role;
