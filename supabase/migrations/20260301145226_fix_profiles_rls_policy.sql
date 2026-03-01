/*
  # Fix profiles RLS policies

  ## Summary
  The existing "Admins can view all profiles" policy uses a self-referencing subquery
  which can prevent the profile from being fetched at all on first load, causing isAdmin
  to always return false.

  This migration drops and recreates the policies using simpler, non-recursive logic.

  ## Changes
  - Drop all existing profiles SELECT policies
  - Recreate a simple "Users can view own profile" policy using auth.uid() = id
  - Recreate "Admins can view all profiles" using a security definer function to avoid recursion
*/

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());
