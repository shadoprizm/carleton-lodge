/*
  # Fix profiles RLS circular dependency

  ## Problem
  Several RLS policies on the `profiles` table use subqueries that reference
  the `profiles` table itself to check `is_admin`. This creates an infinite
  recursion that causes the query to silently return no rows, making `isAdmin`
  always false even when the user is an admin.

  ## Changes
  - Drop the duplicate/circular policies
  - Keep only the simple, non-recursive policies that check auth.uid() directly

  ## Policies after this migration
  - SELECT: Users can read their own profile row (auth.uid() = id)
  - UPDATE: Users can update their own profile row (auth.uid() = id)
*/

DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users or admins can update profiles" ON profiles;
