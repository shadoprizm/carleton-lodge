/*
  # Fix privilege escalation via profiles self-update  (SEC-1, CRITICAL)

  ## Problem
  The "Users can update own profile" RLS policy only checks `auth.uid() = id`
  with no column constraint. An authenticated member could therefore run
  `UPDATE profiles SET is_admin = true WHERE id = auth.uid()` and grant
  themselves full administrator access. The same gap lets a member clear
  their own `force_password_change` flag or change their `email`.

  ## Approach
  RLS `WITH CHECK` cannot compare the new row against the existing row, so we
  add a `BEFORE UPDATE` trigger that forbids end users from changing the
  privileged columns (`is_admin`, `email`). The trigger deliberately allows:
    - full admins            -> `carletonlodge.is_admin()` short-circuits
    - service-role / backend -> `auth.uid()` is NULL (no end-user JWT), e.g.
                                the `manage-member-login` edge function and the
                                `handle_new_user` signup path
  so legitimate flows (admin user management, member provisioning, and the
  forced-password-change completion which only touches `force_password_change`)
  keep working. Only end-user tampering with `is_admin` / `email` is blocked.

  Schema note: this project's live tables reside in the `carletonlodge` schema.
  This migration is written against that schema directly (matching the most
  recent migrations) so it can be applied as-is.
*/

CREATE OR REPLACE FUNCTION carletonlodge.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Backend/service-role calls have no end-user JWT (auth.uid() IS NULL);
  -- full admins are allowed to change anything.
  IF (SELECT auth.uid()) IS NULL OR carletonlodge.is_admin() THEN
    RETURN NEW;
  END IF;

  -- End users may not escalate their role or change their account email.
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    RAISE EXCEPTION 'Not permitted to modify is_admin';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Not permitted to modify email';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON carletonlodge.profiles;
CREATE TRIGGER protect_profile_privileged_columns
  BEFORE UPDATE ON carletonlodge.profiles
  FOR EACH ROW
  EXECUTE FUNCTION carletonlodge.protect_profile_privileged_columns();
