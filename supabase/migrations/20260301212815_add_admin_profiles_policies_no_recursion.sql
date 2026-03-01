/*
  # Add admin policies for profiles without circular recursion

  ## Problem
  Admin users need to be able to view and update all profiles, but the previous
  policies caused circular recursion by querying the profiles table to check is_admin.

  ## Solution
  Use a security definer function to safely check admin status without
  triggering recursive RLS evaluation.

  ## Changes
  - Create a security definer function `is_admin()` that bypasses RLS
  - Add SELECT policy for admins to view all profiles
  - Add UPDATE policy for admins to update any profile
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin() = true);

CREATE POLICY "Admins can update any profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() = true)
  WITH CHECK (public.is_admin() = true);
