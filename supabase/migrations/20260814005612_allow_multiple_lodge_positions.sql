/*
  A Lodge member may hold several offices or functional responsibilities at
  once, while some positions (notably Lodge Auditor) may have more than one
  concurrent holder. Keep lodge_members.position_id as the compatibility
  primary position for existing mailbox and notification workflows, and make
  lodge_member_positions the complete assignment record.
*/

ALTER TABLE public.lodge_positions
  ADD COLUMN IF NOT EXISTS position_type text NOT NULL DEFAULT 'OFFICER',
  ADD COLUMN IF NOT EXISTS max_holders smallint NOT NULL DEFAULT 1;

ALTER TABLE public.lodge_positions
  DROP CONSTRAINT IF EXISTS lodge_positions_position_type_check,
  ADD CONSTRAINT lodge_positions_position_type_check
    CHECK (position_type IN ('OFFICER', 'FUNCTIONAL')),
  DROP CONSTRAINT IF EXISTS lodge_positions_max_holders_check,
  ADD CONSTRAINT lodge_positions_max_holders_check
    CHECK (max_holders >= 1);

UPDATE public.lodge_positions
SET position_type = 'FUNCTIONAL'
WHERE name IN ('Webmaster', 'Lodge Historian');

INSERT INTO public.lodge_positions (
  name,
  display_order,
  position_type,
  max_holders
)
SELECT
  'Lodge Auditor',
  19,
  'FUNCTIONAL',
  2
WHERE NOT EXISTS (
  SELECT 1
  FROM public.lodge_positions
  WHERE lower(name) = lower('Lodge Auditor')
);

UPDATE public.lodge_positions
SET
  position_type = 'FUNCTIONAL',
  max_holders = 2
WHERE lower(name) = lower('Lodge Auditor');

CREATE TABLE public.lodge_member_positions (
  member_id uuid NOT NULL
    REFERENCES public.lodge_members(id) ON DELETE CASCADE,
  position_id uuid NOT NULL
    REFERENCES public.lodge_positions(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, position_id)
);

CREATE UNIQUE INDEX lodge_member_positions_one_primary_idx
  ON public.lodge_member_positions (member_id)
  WHERE is_primary;

CREATE INDEX lodge_member_positions_position_idx
  ON public.lodge_member_positions (position_id, member_id);

ALTER TABLE public.lodge_member_positions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.lodge_member_positions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.lodge_member_positions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lodge_member_positions TO service_role;

CREATE POLICY "Members can view permitted position assignments"
  ON public.lodge_member_positions FOR SELECT TO authenticated
  USING (
    private.has_active_session()
    AND EXISTS (
      SELECT 1
      FROM public.lodge_members AS member
      WHERE member.id = lodge_member_positions.member_id
        AND (
          member.visible_to_members
          OR member.linked_profile_id = (SELECT auth.uid())
          OR private.has_admin_section_permission('members', 'read')
        )
    )
  );

INSERT INTO public.lodge_member_positions (
  member_id,
  position_id,
  is_primary
)
SELECT
  member.id,
  member.position_id,
  true
FROM public.lodge_members AS member
WHERE member.position_id IS NOT NULL
ON CONFLICT (member_id, position_id) DO UPDATE
SET is_primary = EXCLUDED.is_primary;

CREATE OR REPLACE FUNCTION private.enforce_lodge_position_holder_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO pg_catalog, public
AS $$
DECLARE
  holder_limit smallint;
  holder_count integer;
  position_name text;
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.member_id = OLD.member_id
    AND NEW.position_id = OLD.position_id THEN
    RETURN NEW;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.position_id::text, 0)
  );

  SELECT position.max_holders, position.name
  INTO holder_limit, position_name
  FROM public.lodge_positions AS position
  WHERE position.id = NEW.position_id;

  SELECT count(*)
  INTO holder_count
  FROM public.lodge_member_positions AS assignment
  WHERE assignment.position_id = NEW.position_id;

  IF holder_count >= holder_limit THEN
    RAISE EXCEPTION '% already has the maximum of % holder(s)',
      position_name,
      holder_limit
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_lodge_position_holder_limit()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enforce_lodge_position_holder_limit
  BEFORE INSERT OR UPDATE OF member_id, position_id
  ON public.lodge_member_positions
  FOR EACH ROW EXECUTE FUNCTION private.enforce_lodge_position_holder_limit();

CREATE OR REPLACE FUNCTION private.sync_legacy_primary_lodge_position()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.position_id IS NOT DISTINCT FROM OLD.position_id THEN
    RETURN NEW;
  END IF;

  DELETE FROM public.lodge_member_positions
  WHERE member_id = NEW.id;

  IF NEW.position_id IS NOT NULL THEN
    INSERT INTO public.lodge_member_positions (
      member_id,
      position_id,
      is_primary
    ) VALUES (
      NEW.id,
      NEW.position_id,
      true
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_legacy_primary_lodge_position()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER sync_legacy_primary_lodge_position
  AFTER INSERT OR UPDATE OF position_id
  ON public.lodge_members
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_legacy_primary_lodge_position();

CREATE OR REPLACE FUNCTION public.set_lodge_member_positions(
  target_member_id uuid,
  target_position_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  clean_position_ids uuid[];
  primary_position_id uuid;
BEGIN
  IF NOT private.has_active_session()
    OR NOT private.has_admin_section_permission('members', 'write') THEN
    RAISE EXCEPTION 'Insufficient permission'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.lodge_members AS member
    WHERE member.id = target_member_id
  ) THEN
    RAISE EXCEPTION 'Lodge member not found'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(array_agg(candidate.position_id), ARRAY[]::uuid[])
  INTO clean_position_ids
  FROM (
    SELECT DISTINCT requested.position_id
    FROM unnest(coalesce(target_position_ids, ARRAY[]::uuid[]))
      AS requested(position_id)
    WHERE requested.position_id IS NOT NULL
  ) AS candidate;

  IF EXISTS (
    SELECT 1
    FROM unnest(clean_position_ids) AS requested(position_id)
    LEFT JOIN public.lodge_positions AS position
      ON position.id = requested.position_id
    WHERE position.id IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more Lodge positions do not exist'
      USING ERRCODE = '23503';
  END IF;

  SELECT position.id
  INTO primary_position_id
  FROM public.lodge_positions AS position
  WHERE position.id = ANY(clean_position_ids)
  ORDER BY position.display_order, position.name, position.id
  LIMIT 1;

  UPDATE public.lodge_members AS member
  SET position_id = primary_position_id
  WHERE member.id = target_member_id;

  DELETE FROM public.lodge_member_positions AS assignment
  WHERE assignment.member_id = target_member_id;

  INSERT INTO public.lodge_member_positions (
    member_id,
    position_id,
    is_primary
  )
  SELECT
    target_member_id,
    requested.position_id,
    requested.position_id = primary_position_id
  FROM unnest(clean_position_ids) AS requested(position_id);
END;
$$;

REVOKE ALL ON FUNCTION public.set_lodge_member_positions(uuid, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_lodge_member_positions(uuid, uuid[])
  TO authenticated, service_role;

COMMENT ON COLUMN public.lodge_members.position_id IS
  'Compatibility primary position. The complete assignment set is stored in lodge_member_positions.';
COMMENT ON TABLE public.lodge_member_positions IS
  'Current many-to-many Lodge position assignments. Members may hold several positions concurrently.';
COMMENT ON COLUMN public.lodge_positions.position_type IS
  'Separates constitutionally defined Lodge officers from functional responsibilities.';
COMMENT ON COLUMN public.lodge_positions.max_holders IS
  'Maximum number of concurrent members who may hold this position.';

-- Keep Lodge Guide search results current when any assignment changes.
CREATE OR REPLACE FUNCTION carletonlodge_private.refresh_member_knowledge(
  target_member_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  member_record public.lodge_members%ROWTYPE;
  position_names text;
BEGIN
  SELECT member.*
  INTO member_record
  FROM public.lodge_members AS member
  WHERE member.id = target_member_id;

  IF NOT FOUND THEN
    DELETE FROM public.lodge_knowledge
    WHERE source_type = 'member'
      AND source_id = target_member_id;
    RETURN;
  END IF;

  SELECT string_agg(position.name, ' ' ORDER BY position.display_order, position.name)
  INTO position_names
  FROM public.lodge_member_positions AS assignment
  JOIN public.lodge_positions AS position
    ON position.id = assignment.position_id
  WHERE assignment.member_id = target_member_id;

  INSERT INTO public.lodge_knowledge (
    source_type,
    source_id,
    title,
    body,
    keywords,
    source_url,
    visibility,
    source_updated_at
  ) VALUES (
    'member',
    member_record.id,
    member_record.full_name,
    carletonlodge_private.knowledge_plain_text(
      concat_ws(' ', position_names, member_record.bio)
    ),
    concat_ws(' ', 'member officer functional role directory', position_names),
    '/members',
    CASE WHEN member_record.visible_to_members THEN 'members' ELSE 'admin' END,
    member_record.updated_at
  )
  ON CONFLICT (source_type, source_id) DO UPDATE SET
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    keywords = EXCLUDED.keywords,
    visibility = EXCLUDED.visibility,
    source_updated_at = EXCLUDED.source_updated_at,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION carletonlodge_private.sync_member_knowledge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.lodge_knowledge
    WHERE source_type = 'member'
      AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  PERFORM carletonlodge_private.refresh_member_knowledge(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION carletonlodge_private.sync_member_position_knowledge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM carletonlodge_private.refresh_member_knowledge(OLD.member_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE')
    AND (TG_OP = 'INSERT' OR NEW.member_id IS DISTINCT FROM OLD.member_id) THEN
    PERFORM carletonlodge_private.refresh_member_knowledge(NEW.member_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge_private.refresh_member_knowledge(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION carletonlodge_private.sync_member_knowledge()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION carletonlodge_private.sync_member_position_knowledge()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER sync_member_position_knowledge
  AFTER INSERT OR UPDATE OR DELETE
  ON public.lodge_member_positions
  FOR EACH ROW EXECUTE FUNCTION carletonlodge_private.sync_member_position_knowledge();

-- Brian Adams remains Lodge Historian as his primary responsibility and also
-- becomes one of the two current Lodge Auditors.
INSERT INTO public.lodge_member_positions (
  member_id,
  position_id,
  is_primary
)
SELECT
  member.id,
  position.id,
  false
FROM public.lodge_members AS member
CROSS JOIN public.lodge_positions AS position
WHERE lower(member.full_name) = lower('R. W. Bro. Brian Adams')
  AND lower(position.name) = lower('Lodge Auditor')
ON CONFLICT (member_id, position_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_my_lodge_positions()
RETURNS SETOF public.lodge_positions
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO pg_catalog, public
AS $$
  SELECT position.*
  FROM public.lodge_member_positions AS assignment
  JOIN public.lodge_positions AS position
    ON position.id = assignment.position_id
  JOIN public.lodge_members AS member
    ON member.id = assignment.member_id
  WHERE private.has_active_session()
    AND member.linked_profile_id = (SELECT auth.uid())
  ORDER BY position.display_order, position.name;
$$;

REVOKE ALL ON FUNCTION public.get_my_lodge_positions()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_lodge_positions()
  TO authenticated, service_role;

COMMENT ON FUNCTION public.set_lodge_member_positions(uuid, uuid[]) IS
  'Atomically replaces every current position assignment for a Lodge member.';
COMMENT ON FUNCTION public.get_my_lodge_positions() IS
  'Returns every current Lodge position held by the signed-in linked member.';
