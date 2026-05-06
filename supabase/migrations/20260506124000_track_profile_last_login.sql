/*
  # Track app-owned last login timestamps

  Supabase Auth's `auth.users.last_sign_in_at` is not writable by the app and
  can miss app-level session activity. Store a local timestamp on profiles and
  update it through a constrained SECURITY DEFINER RPC for the current user.
*/

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;

UPDATE public.profiles p
SET last_sign_in_at = u.last_sign_in_at
FROM auth.users u
WHERE p.id = u.id
  AND p.last_sign_in_at IS NULL
  AND u.last_sign_in_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_current_user_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := (SELECT auth.uid());
BEGIN
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET last_sign_in_at = now(),
      updated_at = now()
  WHERE id = current_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_current_user_login() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_current_user_login() TO authenticated;

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
  SELECT
    u.id,
    COALESCE(
      GREATEST(p.last_sign_in_at, u.last_sign_in_at),
      p.last_sign_in_at,
      u.last_sign_in_at
    ) AS last_sign_in_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = (SELECT auth.uid())
      AND admin_profile.is_admin = true
  );
$$;

REVOKE ALL ON FUNCTION public.get_admin_user_last_signins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_user_last_signins() TO authenticated;
