/*
  Remove an obsolete Auth-reading RPC and make the current-user login timestamp
  update run with the caller's normal RLS privileges.
*/

DROP FUNCTION IF EXISTS carletonlodge.get_admin_user_last_signins();

CREATE OR REPLACE FUNCTION carletonlodge.record_current_user_login()
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  UPDATE carletonlodge.profiles
  SET
    last_sign_in_at = now(),
    updated_at = now()
  WHERE id = (SELECT auth.uid());
$$;

REVOKE ALL ON FUNCTION carletonlodge.record_current_user_login()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION carletonlodge.record_current_user_login()
  TO authenticated;
