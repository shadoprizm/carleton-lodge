-- Documents have a persistent, library-owned order within their category.
-- This is deliberately separate from created_at so archives can be uploaded
-- in any sequence and arranged afterward.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS display_order bigint;

WITH ranked_documents AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY category_id
      ORDER BY created_at DESC NULLS LAST, id
    ) - 1 AS display_order
  FROM public.documents
)
UPDATE public.documents AS document
SET display_order = ranked.display_order
FROM ranked_documents AS ranked
WHERE document.id = ranked.id
  AND document.display_order IS NULL;

CREATE OR REPLACE FUNCTION private.assign_document_display_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT'
    OR NEW.category_id IS DISTINCT FROM OLD.category_id THEN
    SELECT coalesce(max(document.display_order) + 1, 0)
    INTO NEW.display_order
    FROM public.documents AS document
    WHERE document.category_id IS NOT DISTINCT FROM NEW.category_id
      AND document.id IS DISTINCT FROM NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.assign_document_display_order()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS assign_document_display_order
  ON public.documents;
CREATE TRIGGER assign_document_display_order
  BEFORE INSERT OR UPDATE OF category_id
  ON public.documents
  FOR EACH ROW EXECUTE FUNCTION private.assign_document_display_order();

ALTER TABLE public.documents
  ALTER COLUMN display_order SET NOT NULL;

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_display_order_nonnegative,
  ADD CONSTRAINT documents_display_order_nonnegative
    CHECK (display_order >= 0);

CREATE INDEX IF NOT EXISTS documents_category_display_order_idx
  ON public.documents(category_id, display_order, created_at DESC, id);

-- Library editors own ordering even when a document is sourced from Summons.
-- Every other field on a linked summons remains protected from direct edits.
CREATE OR REPLACE FUNCTION private.protect_linked_summons_library_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.summons_id IS NOT NULL
    AND pg_trigger_depth() = 1
    AND (
      to_jsonb(NEW) - 'display_order'
    ) IS DISTINCT FROM (
      to_jsonb(OLD) - 'display_order'
    ) THEN
    RAISE EXCEPTION
      'Linked summons documents can only be reordered from the library';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.protect_linked_summons_library_source()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_linked_summons_library_source
  ON public.documents;
CREATE TRIGGER protect_linked_summons_library_source
  BEFORE UPDATE
  ON public.documents
  FOR EACH ROW EXECUTE FUNCTION private.protect_linked_summons_library_source();

DROP POLICY IF EXISTS "Library editors can update documents"
  ON public.documents;
CREATE POLICY "Library editors can update documents"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (public.has_admin_section_permission('library', 'write'))
  WITH CHECK (public.has_admin_section_permission('library', 'write'));

CREATE OR REPLACE FUNCTION public.reorder_library_documents(
  target_category_id uuid,
  ordered_document_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  category_document_count integer;
  requested_document_count integer;
  requested_unique_count integer;
BEGIN
  IF NOT public.has_admin_section_permission('library', 'write') THEN
    RAISE EXCEPTION 'Library write permission is required';
  END IF;

  IF ordered_document_ids IS NULL THEN
    RAISE EXCEPTION 'The complete ordered document list is required';
  END IF;

  SELECT count(*)
  INTO category_document_count
  FROM public.documents AS document
  WHERE document.category_id IS NOT DISTINCT FROM target_category_id;

  SELECT count(*), count(DISTINCT requested.id)
  INTO requested_document_count, requested_unique_count
  FROM unnest(ordered_document_ids) AS requested(id);

  IF requested_document_count <> requested_unique_count
    OR requested_document_count <> category_document_count
    OR EXISTS (
      SELECT 1
      FROM unnest(ordered_document_ids) AS requested(id)
      LEFT JOIN public.documents AS document
        ON document.id = requested.id
      WHERE document.id IS NULL
        OR document.category_id IS DISTINCT FROM target_category_id
    ) THEN
    RAISE EXCEPTION
      'Document list is stale or does not match the selected category';
  END IF;

  UPDATE public.documents AS document
  SET display_order = requested.position - 1
  FROM unnest(ordered_document_ids)
    WITH ORDINALITY AS requested(id, position)
  WHERE document.id = requested.id
    AND document.display_order IS DISTINCT FROM requested.position - 1;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_library_documents(uuid, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_library_documents(uuid, uuid[])
  TO authenticated;

COMMENT ON FUNCTION public.reorder_library_documents(uuid, uuid[]) IS
  'Atomically persists the complete display order for one document category.';
