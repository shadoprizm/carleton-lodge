/*
  # Harden privileged RPC boundaries

  The public RPC names remain unchanged for the web app, Edge Functions, and
  RLS policies. Their SECURITY DEFINER implementations move to a non-exposed
  schema, while public SECURITY INVOKER wrappers preserve the API contract.
*/

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Preserve the existing implementations and their dependency OIDs. Existing
-- policies that reference these functions continue to call the moved objects.
ALTER FUNCTION public.approve_district_mailroom_import(uuid, jsonb)
  SET SCHEMA private;
ALTER FUNCTION public.approve_mailroom_import(uuid, jsonb)
  SET SCHEMA private;
ALTER FUNCTION public.current_lodge_member_id()
  SET SCHEMA private;
ALTER FUNCTION public.get_email_agreement_receipt(uuid)
  SET SCHEMA private;
ALTER FUNCTION public.get_managed_lodge_members()
  SET SCHEMA private;
ALTER FUNCTION public.get_my_lodge_email_accounts()
  SET SCHEMA private;
ALTER FUNCTION public.has_admin_section_permission(text, text)
  SET SCHEMA private;
ALTER FUNCTION public.is_admin()
  SET SCHEMA private;
ALTER FUNCTION public.reject_mailroom_import(uuid)
  SET SCHEMA private;

-- The private functions remain callable only through their public wrappers or
-- by the service role. Each implementation already derives auth.uid() from the
-- request and enforces ownership or a section permission before returning data
-- or changing state.
REVOKE ALL ON FUNCTION private.approve_district_mailroom_import(uuid, jsonb)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.approve_mailroom_import(uuid, jsonb)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_lodge_member_id()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.get_email_agreement_receipt(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.get_managed_lodge_members()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.get_my_lodge_email_accounts()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_admin_section_permission(text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_admin()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.reject_mailroom_import(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.approve_district_mailroom_import(uuid, jsonb)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.approve_mailroom_import(uuid, jsonb)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_lodge_member_id()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_email_agreement_receipt(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_managed_lodge_members()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_my_lodge_email_accounts()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_admin_section_permission(text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.reject_mailroom_import(uuid)
  TO authenticated, service_role;

CREATE FUNCTION public.approve_district_mailroom_import(
  target_import_id uuid,
  reviewed_payload jsonb
)
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path TO pg_catalog
AS $$
  SELECT private.approve_district_mailroom_import(
    target_import_id,
    reviewed_payload
  );
$$;

CREATE FUNCTION public.approve_mailroom_import(
  target_import_id uuid,
  reviewed_payload jsonb
)
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path TO pg_catalog
AS $$
  SELECT private.approve_mailroom_import(target_import_id, reviewed_payload);
$$;

CREATE FUNCTION public.current_lodge_member_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO pg_catalog
AS $$
  SELECT private.current_lodge_member_id();
$$;

CREATE FUNCTION public.get_email_agreement_receipt(target_account_id uuid)
RETURNS TABLE(
  acceptance_id uuid,
  member_name text,
  email_address text,
  position_name text,
  agreement_title text,
  agreement_version integer,
  effective_at timestamptz,
  accepted_at timestamptz,
  acknowledgement text,
  policy_content text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO pg_catalog
AS $$
  SELECT * FROM private.get_email_agreement_receipt(target_account_id);
$$;

CREATE FUNCTION public.get_managed_lodge_members()
RETURNS SETOF public.lodge_members
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO pg_catalog
AS $$
  SELECT * FROM private.get_managed_lodge_members();
$$;

CREATE FUNCTION public.get_my_lodge_email_accounts()
RETURNS TABLE(
  id uuid,
  address text,
  account_type text,
  status text,
  display_name text,
  position_id uuid,
  position_name text,
  credential_status text,
  provisioned_at timestamptz,
  activated_at timestamptz,
  last_credential_rotation_at timestamptz,
  last_handover_at timestamptz,
  policy_version_id uuid,
  policy_title text,
  policy_version integer,
  policy_content text,
  policy_acknowledgement text,
  policy_effective_at timestamptz,
  agreement_accepted_at timestamptz,
  needs_agreement boolean,
  needs_password_setup boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO pg_catalog
AS $$
  SELECT * FROM private.get_my_lodge_email_accounts();
$$;

CREATE FUNCTION public.has_admin_section_permission(
  target_section text,
  access_level text DEFAULT 'read'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO pg_catalog
AS $$
  SELECT private.has_admin_section_permission(target_section, access_level);
$$;

CREATE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO pg_catalog
AS $$
  SELECT private.is_admin();
$$;

CREATE FUNCTION public.reject_mailroom_import(target_import_id uuid)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path TO pg_catalog
AS $$
  SELECT private.reject_mailroom_import(target_import_id);
$$;

REVOKE ALL ON FUNCTION public.approve_district_mailroom_import(uuid, jsonb)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_mailroom_import(uuid, jsonb)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_lodge_member_id()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_email_agreement_receipt(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_managed_lodge_members()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_lodge_email_accounts()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_admin_section_permission(text, text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_mailroom_import(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.approve_district_mailroom_import(uuid, jsonb)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_mailroom_import(uuid, jsonb)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_lodge_member_id()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_email_agreement_receipt(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_managed_lodge_members()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_lodge_email_accounts()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_admin_section_permission(text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_mailroom_import(uuid)
  TO authenticated, service_role;

-- Prevent future functions from becoming callable through the Data API unless
-- a migration grants access deliberately.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Browser roles already have all table privileges revoked. This explicit
-- deny-all policy adds defense in depth and makes that intent machine-auditable.
CREATE POLICY "Member activity is server-only"
ON public.member_activity
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
