-- Expose user last sign-in timestamps to admins via RPC.
-- This avoids exposing auth.users directly to the client.
CREATE OR REPLACE FUNCTION public.get_admin_user_last_signins()
RETURNS TABLE (
  id uuid,
  last_sign_in_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id, u.last_sign_in_at
  FROM auth.users u
  WHERE public.is_admin() = true;
$$;

REVOKE ALL ON FUNCTION public.get_admin_user_last_signins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_user_last_signins() TO authenticated;
