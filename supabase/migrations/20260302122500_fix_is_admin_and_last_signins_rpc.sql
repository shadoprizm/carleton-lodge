-- Repair admin helper function and last-signin RPC so they work with a locked search_path.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.is_admin = true
  );
$$;

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
  WHERE EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.is_admin = true
  );
$$;

REVOKE ALL ON FUNCTION public.get_admin_user_last_signins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_user_last_signins() TO authenticated;
