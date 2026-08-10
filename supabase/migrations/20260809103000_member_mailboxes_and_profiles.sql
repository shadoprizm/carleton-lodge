/*
  Member lodge mailboxes are deliberately separate from personal sign-in and
  recovery email addresses. The lodge address is member-directory data; the
  personal address remains account/admin data.
*/

ALTER TABLE carletonlodge.lodge_members
  ADD COLUMN IF NOT EXISTS lodge_email text,
  ADD COLUMN IF NOT EXISTS mailbox_status text NOT NULL DEFAULT 'unprovisioned',
  ADD COLUMN IF NOT EXISTS mailbox_quota_mb integer NOT NULL DEFAULT 250,
  ADD COLUMN IF NOT EXISTS mailbox_send_limit integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS mailbox_provisioned_at timestamptz,
  ADD COLUMN IF NOT EXISTS mailbox_activated_at timestamptz;

ALTER TABLE carletonlodge.lodge_members
  DROP CONSTRAINT IF EXISTS lodge_members_lodge_email_format,
  ADD CONSTRAINT lodge_members_lodge_email_format CHECK (
    lodge_email IS NULL OR lodge_email ~ '^[a-z0-9][a-z0-9._-]*@carpmasons[.]ca$'
  ),
  DROP CONSTRAINT IF EXISTS lodge_members_mailbox_status_check,
  ADD CONSTRAINT lodge_members_mailbox_status_check CHECK (
    mailbox_status IN (
      'unprovisioned',
      'provisioning',
      'pending_activation',
      'active',
      'error',
      'suspended'
    )
  ),
  DROP CONSTRAINT IF EXISTS lodge_members_mailbox_quota_check,
  ADD CONSTRAINT lodge_members_mailbox_quota_check CHECK (
    mailbox_quota_mb BETWEEN 100 AND 5120
  ),
  DROP CONSTRAINT IF EXISTS lodge_members_mailbox_send_limit_check,
  ADD CONSTRAINT lodge_members_mailbox_send_limit_check CHECK (
    mailbox_send_limit BETWEEN 1 AND 500
  );

CREATE UNIQUE INDEX IF NOT EXISTS lodge_members_lodge_email_unique_idx
  ON carletonlodge.lodge_members (lower(lodge_email))
  WHERE lodge_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS lodge_members_mailbox_status_idx
  ON carletonlodge.lodge_members (mailbox_status)
  WHERE mailbox_status <> 'unprovisioned';

-- A signed-in member may read directory/profile fields, but not the personal
-- sign-in/recovery email or home address. Member managers receive those private
-- fields through the permission-checked RPC below.
REVOKE SELECT ON carletonlodge.lodge_members FROM authenticated;
GRANT SELECT (
  id,
  full_name,
  phone,
  join_date,
  position_id,
  bio,
  visible_to_members,
  linked_profile_id,
  lodge_email,
  mailbox_status,
  mailbox_provisioned_at,
  mailbox_activated_at,
  created_at,
  updated_at
) ON carletonlodge.lodge_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON carletonlodge.lodge_members TO service_role;
REVOKE ALL ON carletonlodge.lodge_members FROM anon;

CREATE OR REPLACE FUNCTION carletonlodge.get_managed_lodge_members()
RETURNS SETOF carletonlodge.lodge_members
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, carletonlodge
AS $$
BEGIN
  IF NOT carletonlodge.has_admin_section_permission('members', 'read') THEN
    RAISE EXCEPTION 'Insufficient permission'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT member.*
  FROM carletonlodge.lodge_members AS member
  ORDER BY member.full_name;
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge.get_managed_lodge_members()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION carletonlodge.get_managed_lodge_members()
  TO authenticated;

COMMENT ON COLUMN carletonlodge.lodge_members.email IS
  'Private personal address used for website sign-in, recovery, and welcome email delivery.';
COMMENT ON COLUMN carletonlodge.lodge_members.lodge_email IS
  'Member-visible carpmasons.ca mailbox address provisioned through MXroute.';
COMMENT ON COLUMN carletonlodge.lodge_members.mailbox_status IS
  'Lifecycle state for the MXroute mailbox; mailbox passwords are never stored.';
