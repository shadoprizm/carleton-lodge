/*
  # Member self-service profiles

  Linked members can maintain their phone number, private home address, and
  biography through a narrow ownership-checked RPC. Grand Lodge membership
  numbers remain administrator-managed and are returned only to the member
  themself or through the existing permission-checked roster manager RPC.
*/

ALTER TABLE public.lodge_members
  ADD COLUMN IF NOT EXISTS grand_lodge_membership_number text;

ALTER TABLE public.lodge_members
  DROP CONSTRAINT IF EXISTS lodge_members_phone_length,
  ADD CONSTRAINT lodge_members_phone_length CHECK (
    phone IS NULL OR length(btrim(phone)) BETWEEN 1 AND 50
  ),
  DROP CONSTRAINT IF EXISTS lodge_members_address_length,
  ADD CONSTRAINT lodge_members_address_length CHECK (
    address IS NULL OR length(btrim(address)) BETWEEN 1 AND 500
  ),
  DROP CONSTRAINT IF EXISTS lodge_members_bio_length,
  ADD CONSTRAINT lodge_members_bio_length CHECK (
    bio IS NULL OR length(btrim(bio)) BETWEEN 1 AND 2000
  ),
  DROP CONSTRAINT IF EXISTS lodge_members_grand_lodge_number_format,
  ADD CONSTRAINT lodge_members_grand_lodge_number_format CHECK (
    grand_lodge_membership_number IS NULL
    OR (
      grand_lodge_membership_number = btrim(grand_lodge_membership_number)
      AND length(grand_lodge_membership_number) BETWEEN 1 AND 50
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS lodge_members_grand_lodge_number_unique_idx
  ON public.lodge_members (lower(grand_lodge_membership_number))
  WHERE grand_lodge_membership_number IS NOT NULL;

COMMENT ON COLUMN public.lodge_members.grand_lodge_membership_number IS
  'Grand Lodge membership identifier. Visible only to the linked member and authorised member managers.';

-- Run before the member search-index trigger so its source timestamp reflects
-- every member edit, regardless of whether it came from the admin UI or RPC.
DROP TRIGGER IF EXISTS set_lodge_members_updated_at ON public.lodge_members;
CREATE TRIGGER set_lodge_members_updated_at
  BEFORE UPDATE ON public.lodge_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Newly added columns receive no authenticated SELECT grant when the table is
-- already using column-level reads. Keep the two private fields explicit too.
REVOKE SELECT (address, grand_lodge_membership_number)
  ON public.lodge_members FROM authenticated;

DROP POLICY IF EXISTS "Authenticated users can view lodge members"
  ON public.lodge_members;
DROP POLICY IF EXISTS "Admins can view all lodge members"
  ON public.lodge_members;
DROP POLICY IF EXISTS "Member managers can view all lodge members"
  ON public.lodge_members;
CREATE POLICY "Authenticated users can view lodge members"
  ON public.lodge_members FOR SELECT TO authenticated
  USING (
    private.has_active_session()
    AND (
      visible_to_members = true
      OR linked_profile_id = (SELECT auth.uid())
      OR private.has_admin_section_permission('members', 'read')
    )
  );

CREATE OR REPLACE FUNCTION private.get_my_member_profile()
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  address text,
  join_date date,
  position_id uuid,
  position_name text,
  bio text,
  visible_to_members boolean,
  lodge_email text,
  mailbox_status text,
  grand_lodge_membership_number text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
BEGIN
  IF NOT private.has_active_session() THEN
    RAISE EXCEPTION 'An active member session is required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    member.id,
    member.full_name,
    member.phone,
    member.address,
    member.join_date,
    member.position_id,
    position.name,
    member.bio,
    member.visible_to_members,
    member.lodge_email,
    member.mailbox_status,
    member.grand_lodge_membership_number,
    member.created_at,
    member.updated_at
  FROM public.lodge_members AS member
  LEFT JOIN public.lodge_positions AS position
    ON position.id = member.position_id
  WHERE member.linked_profile_id = (SELECT auth.uid())
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION private.update_my_member_profile(
  new_phone text,
  new_address text,
  new_bio text
)
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  address text,
  join_date date,
  position_id uuid,
  position_name text,
  bio text,
  visible_to_members boolean,
  lodge_email text,
  mailbox_status text,
  grand_lodge_membership_number text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  updated_member_id uuid;
BEGIN
  IF NOT private.has_active_session() THEN
    RAISE EXCEPTION 'An active member session is required'
      USING ERRCODE = '42501';
  END IF;

  IF length(btrim(coalesce(new_phone, ''))) > 50 THEN
    RAISE EXCEPTION 'Phone number must be 50 characters or fewer'
      USING ERRCODE = '22001';
  END IF;

  IF length(btrim(coalesce(new_address, ''))) > 500 THEN
    RAISE EXCEPTION 'Home address must be 500 characters or fewer'
      USING ERRCODE = '22001';
  END IF;

  IF length(btrim(coalesce(new_bio, ''))) > 2000 THEN
    RAISE EXCEPTION 'Biography must be 2000 characters or fewer'
      USING ERRCODE = '22001';
  END IF;

  UPDATE public.lodge_members AS member
  SET
    phone = nullif(btrim(new_phone), ''),
    address = nullif(btrim(new_address), ''),
    bio = nullif(btrim(new_bio), '')
  WHERE member.linked_profile_id = (SELECT auth.uid())
  RETURNING member.id INTO updated_member_id;

  IF updated_member_id IS NULL THEN
    RAISE EXCEPTION 'No Lodge roster record is linked to this account'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY SELECT * FROM private.get_my_member_profile();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_member_profile()
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  address text,
  join_date date,
  position_id uuid,
  position_name text,
  bio text,
  visible_to_members boolean,
  lodge_email text,
  mailbox_status text,
  grand_lodge_membership_number text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO pg_catalog
AS $$
  SELECT * FROM private.get_my_member_profile();
$$;

CREATE OR REPLACE FUNCTION public.update_my_member_profile(
  new_phone text,
  new_address text,
  new_bio text
)
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  address text,
  join_date date,
  position_id uuid,
  position_name text,
  bio text,
  visible_to_members boolean,
  lodge_email text,
  mailbox_status text,
  grand_lodge_membership_number text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path TO pg_catalog
AS $$
  SELECT * FROM private.update_my_member_profile(new_phone, new_address, new_bio);
$$;

REVOKE ALL ON FUNCTION private.get_my_member_profile()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.update_my_member_profile(text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.get_my_member_profile()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.update_my_member_profile(text, text, text)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_my_member_profile()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_my_member_profile(text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_member_profile()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_my_member_profile(text, text, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_my_member_profile() IS
  'Returns the current linked member profile, including self-only private fields.';
COMMENT ON FUNCTION public.update_my_member_profile(text, text, text) IS
  'Allows a linked member to update only phone, private address, and biography.';

UPDATE public.help_topics
SET
  body = 'Sign in and open Officers & Members from My Lodge. The directory only shows entries approved for member viewing. Choose My Profile to update your phone number, private home address, or biography. Contact the Secretary for changes to your name, office, membership details, or account link.',
  keywords = ARRAY['officer', 'secretary', 'member', 'phone', 'address', 'bio', 'profile', 'directory'],
  url = '/my-lodge/profile'
WHERE category = 'Member information'
  AND title = 'How do I find an officer or lodge member?';
