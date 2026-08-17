/*
  # Member contact and spouse details

  Store a second phone number and spouse name on the canonical Lodge roster.
  Both fields are private: only the linked member and authorised roster
  managers receive them through permission-checked RPCs.
*/

-- PostgreSQL cannot change a function's result row type in place. Drop the
-- public wrappers first because they depend on the private implementations.
DROP FUNCTION IF EXISTS public.update_my_member_profile(text, text, text);
DROP FUNCTION IF EXISTS public.get_my_member_profile();
DROP FUNCTION IF EXISTS private.update_my_member_profile(text, text, text);
DROP FUNCTION IF EXISTS private.get_my_member_profile();

ALTER TABLE public.lodge_members
  ADD COLUMN IF NOT EXISTS alternate_phone text,
  ADD COLUMN IF NOT EXISTS spouse_name text;

ALTER TABLE public.lodge_members
  DROP CONSTRAINT IF EXISTS lodge_members_alternate_phone_length,
  ADD CONSTRAINT lodge_members_alternate_phone_length CHECK (
    alternate_phone IS NULL OR length(btrim(alternate_phone)) BETWEEN 1 AND 50
  ),
  DROP CONSTRAINT IF EXISTS lodge_members_spouse_name_format,
  ADD CONSTRAINT lodge_members_spouse_name_format CHECK (
    spouse_name IS NULL
    OR (
      spouse_name = btrim(spouse_name)
      AND length(spouse_name) BETWEEN 1 AND 200
    )
  );

COMMENT ON COLUMN public.lodge_members.alternate_phone IS
  'Optional second phone number. Visible only to the linked member and authorised roster managers.';
COMMENT ON COLUMN public.lodge_members.spouse_name IS
  'Member-provided spouse name. Visible only to the linked member and authorised roster managers.';

-- The authenticated directory grant intentionally excludes these columns.
REVOKE SELECT (alternate_phone, spouse_name)
  ON public.lodge_members FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.get_my_member_profile()
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  alternate_phone text,
  address text,
  spouse_name text,
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
    member.alternate_phone,
    member.address,
    member.spouse_name,
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

CREATE FUNCTION private.update_my_member_profile(
  new_phone text,
  new_alternate_phone text,
  new_address text,
  new_spouse_name text,
  new_bio text
)
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  alternate_phone text,
  address text,
  spouse_name text,
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

  IF length(btrim(coalesce(new_alternate_phone, ''))) > 50 THEN
    RAISE EXCEPTION 'Alternate phone number must be 50 characters or fewer'
      USING ERRCODE = '22001';
  END IF;

  IF length(btrim(coalesce(new_address, ''))) > 500 THEN
    RAISE EXCEPTION 'Home address must be 500 characters or fewer'
      USING ERRCODE = '22001';
  END IF;

  IF length(btrim(coalesce(new_spouse_name, ''))) > 200 THEN
    RAISE EXCEPTION 'Spouse name must be 200 characters or fewer'
      USING ERRCODE = '22001';
  END IF;

  IF length(btrim(coalesce(new_bio, ''))) > 2000 THEN
    RAISE EXCEPTION 'Biography must be 2000 characters or fewer'
      USING ERRCODE = '22001';
  END IF;

  UPDATE public.lodge_members AS member
  SET
    phone = nullif(btrim(new_phone), ''),
    alternate_phone = nullif(btrim(new_alternate_phone), ''),
    address = nullif(btrim(new_address), ''),
    spouse_name = nullif(btrim(new_spouse_name), ''),
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

CREATE FUNCTION public.get_my_member_profile()
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  alternate_phone text,
  address text,
  spouse_name text,
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

CREATE FUNCTION public.update_my_member_profile(
  new_phone text,
  new_alternate_phone text,
  new_address text,
  new_spouse_name text,
  new_bio text
)
RETURNS TABLE (
  id uuid,
  full_name text,
  phone text,
  alternate_phone text,
  address text,
  spouse_name text,
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
  SELECT * FROM private.update_my_member_profile(
    new_phone,
    new_alternate_phone,
    new_address,
    new_spouse_name,
    new_bio
  );
$$;

REVOKE ALL ON FUNCTION private.get_my_member_profile()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.update_my_member_profile(text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.get_my_member_profile()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.update_my_member_profile(text, text, text, text, text)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_my_member_profile()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_my_member_profile(text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_member_profile()
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_my_member_profile(text, text, text, text, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_my_member_profile() IS
  'Returns the current linked member profile, including self-only private fields.';
COMMENT ON FUNCTION public.update_my_member_profile(text, text, text, text, text) IS
  'Allows a linked member to update phone numbers, private address, spouse name, and biography.';

UPDATE public.help_topics
SET
  body = 'Sign in and open Officers & Members from My Lodge. The directory only shows entries approved for member viewing. Choose My Profile to update your phone numbers, private home address, spouse name, or biography. Contact the Secretary for changes to your name, office, membership details, or account link.',
  keywords = ARRAY['officer', 'secretary', 'member', 'phone', 'address', 'spouse', 'bio', 'profile', 'directory'],
  url = '/my-lodge/profile'
WHERE category = 'Member information'
  AND title = 'How do I find an officer or lodge member?';
