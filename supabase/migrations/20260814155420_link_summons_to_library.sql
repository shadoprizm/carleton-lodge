-- A summons is the source of truth for its PDF. The document library keeps a
-- one-to-one linked index row so members can find the same stored file in
-- either place without maintaining a second, independent upload.

ALTER TABLE public.summons
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS file_type text;

ALTER TABLE public.summons
  DROP CONSTRAINT IF EXISTS summons_file_size_check,
  ADD CONSTRAINT summons_file_size_check CHECK (
    file_size IS NULL OR file_size >= 0
  );

-- Notifications are intentionally opt-in for manually published summons.
-- Mailroom workflows can still explicitly set notify_members when approved.
ALTER TABLE public.summons
  ALTER COLUMN notify_members SET DEFAULT false;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS summons_id uuid
    REFERENCES public.summons(id) ON DELETE CASCADE;

-- Give summons their own permanent category. Reuse the existing category so
-- current library links retain their category_id.
DO $$
DECLARE
  summons_category_id uuid;
  legacy_category_id uuid;
BEGIN
  SELECT id INTO summons_category_id
  FROM public.document_categories
  WHERE lower(name) = 'summons'
  ORDER BY created_at
  LIMIT 1;

  SELECT id INTO legacy_category_id
  FROM public.document_categories
  WHERE name = 'Notices & Summons'
  ORDER BY created_at
  LIMIT 1;

  IF summons_category_id IS NULL AND legacy_category_id IS NOT NULL THEN
    UPDATE public.document_categories
    SET
      name = 'Summons',
      description = 'Monthly summons and archived lodge notices',
      updated_at = now()
    WHERE id = legacy_category_id;
  ELSIF summons_category_id IS NULL THEN
    INSERT INTO public.document_categories (
      name,
      description,
      display_order
    ) VALUES (
      'Summons',
      'Monthly summons and archived lodge notices',
      3
    );
  ELSIF legacy_category_id IS NOT NULL
    AND legacy_category_id <> summons_category_id THEN
    UPDATE public.documents
    SET category_id = summons_category_id
    WHERE category_id = legacy_category_id;

    DELETE FROM public.document_categories
    WHERE id = legacy_category_id;
  END IF;
END;
$$;

-- Preserve the original upload metadata when a library row already exists,
-- then fall back to the stored object name for older summons.
UPDATE public.summons AS summons
SET
  file_name = coalesce(
    summons.file_name,
    (
      SELECT document.file_name
      FROM public.documents AS document
      WHERE document.storage_bucket = 'summons-uploads'
        AND document.file_url = summons.pdf_url
      ORDER BY document.created_at, document.id
      LIMIT 1
    ),
    nullif(
      regexp_replace(
        regexp_replace(summons.pdf_url, '^.*/', ''),
        '^[0-9]+-',
        ''
      ),
      ''
    )
  ),
  file_size = coalesce(
    summons.file_size,
    (
      SELECT document.file_size
      FROM public.documents AS document
      WHERE document.storage_bucket = 'summons-uploads'
        AND document.file_url = summons.pdf_url
      ORDER BY document.created_at, document.id
      LIMIT 1
    )
  ),
  file_type = coalesce(
    summons.file_type,
    (
      SELECT document.file_type
      FROM public.documents AS document
      WHERE document.storage_bucket = 'summons-uploads'
        AND document.file_url = summons.pdf_url
      ORDER BY document.created_at, document.id
      LIMIT 1
    ),
    'application/pdf'
  )
WHERE summons.pdf_url IS NOT NULL;

-- Link one existing library row per summons before backfilling any missing
-- rows. Exact duplicate index rows are removed; the Storage object is kept.
WITH matches AS (
  SELECT
    document.id AS document_id,
    summons.id AS summons_id,
    row_number() OVER (
      PARTITION BY summons.id
      ORDER BY document.created_at, document.id
    ) AS match_order
  FROM public.summons AS summons
  JOIN public.documents AS document
    ON document.storage_bucket = 'summons-uploads'
   AND document.file_url = summons.pdf_url
  WHERE summons.pdf_url IS NOT NULL
)
UPDATE public.documents AS document
SET summons_id = matches.summons_id
FROM matches
WHERE document.id = matches.document_id
  AND matches.match_order = 1;

WITH duplicate_matches AS (
  SELECT document.id AS document_id
  FROM public.summons AS summons
  JOIN public.documents AS document
    ON document.storage_bucket = 'summons-uploads'
   AND document.file_url = summons.pdf_url
  WHERE summons.pdf_url IS NOT NULL
    AND document.summons_id IS NULL
    AND document.tags @> ARRAY['summons']::text[]
)
DELETE FROM public.documents AS document
USING duplicate_matches
WHERE document.id = duplicate_matches.document_id;

CREATE UNIQUE INDEX IF NOT EXISTS documents_summons_id_unique
  ON public.documents(summons_id)
  WHERE summons_id IS NOT NULL;

INSERT INTO public.documents (
  category_id,
  summons_id,
  title,
  description,
  file_url,
  file_name,
  file_size,
  file_type,
  tags,
  storage_bucket,
  uploaded_by,
  source_mailroom_import_id,
  source_issuer,
  rights_reviewed,
  include_in_lodge_guide
)
SELECT
  category.id,
  summons.id,
  summons.title,
  summons.month,
  summons.pdf_url,
  coalesce(
    nullif(summons.file_name, ''),
    nullif(
      regexp_replace(
        regexp_replace(summons.pdf_url, '^.*/', ''),
        '^[0-9]+-',
        ''
      ),
      ''
    ),
    'summons.pdf'
  ),
  summons.file_size,
  coalesce(nullif(summons.file_type, ''), 'application/pdf'),
  ARRAY['summons', lower(summons.month)],
  'summons-uploads',
  summons.created_by,
  summons.source_mailroom_import_id,
  summons.source_issuer,
  true,
  false
FROM public.summons AS summons
CROSS JOIN LATERAL (
  SELECT id
  FROM public.document_categories
  WHERE lower(name) = 'summons'
  ORDER BY created_at
  LIMIT 1
) AS category
WHERE summons.pdf_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.documents AS document
    WHERE document.summons_id = summons.id
  );

CREATE OR REPLACE FUNCTION private.sync_summons_library_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  summons_category_id uuid;
BEGIN
  -- Approved Mailroom publications insert their document later in the same
  -- transaction. The document trigger below links that richer source record.
  IF TG_OP = 'INSERT' AND NEW.source_mailroom_import_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.pdf_url IS NULL OR btrim(NEW.pdf_url) = '' THEN
    DELETE FROM public.documents
    WHERE summons_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT id INTO summons_category_id
  FROM public.document_categories
  WHERE lower(name) = 'summons'
  ORDER BY created_at
  LIMIT 1;

  IF summons_category_id IS NULL THEN
    RAISE EXCEPTION 'The Summons library category is missing';
  END IF;

  INSERT INTO public.documents (
    category_id,
    summons_id,
    title,
    description,
    file_url,
    file_name,
    file_size,
    file_type,
    tags,
    storage_bucket,
    uploaded_by,
    source_mailroom_import_id,
    source_issuer,
    rights_reviewed,
    include_in_lodge_guide
  ) VALUES (
    summons_category_id,
    NEW.id,
    NEW.title,
    NEW.month,
    NEW.pdf_url,
    coalesce(
      nullif(NEW.file_name, ''),
      nullif(
        regexp_replace(
          regexp_replace(NEW.pdf_url, '^.*/', ''),
          '^[0-9]+-',
          ''
        ),
        ''
      ),
      'summons.pdf'
    ),
    NEW.file_size,
    coalesce(nullif(NEW.file_type, ''), 'application/pdf'),
    ARRAY['summons', lower(NEW.month)],
    'summons-uploads',
    NEW.created_by,
    NEW.source_mailroom_import_id,
    NEW.source_issuer,
    true,
    false
  )
  ON CONFLICT (summons_id) WHERE summons_id IS NOT NULL
  DO UPDATE SET
    category_id = EXCLUDED.category_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    file_url = EXCLUDED.file_url,
    file_name = EXCLUDED.file_name,
    file_size = EXCLUDED.file_size,
    file_type = EXCLUDED.file_type,
    tags = EXCLUDED.tags,
    storage_bucket = EXCLUDED.storage_bucket,
    uploaded_by = coalesce(EXCLUDED.uploaded_by, documents.uploaded_by),
    source_mailroom_import_id = EXCLUDED.source_mailroom_import_id,
    source_issuer = EXCLUDED.source_issuer,
    rights_reviewed = EXCLUDED.rights_reviewed,
    include_in_lodge_guide = EXCLUDED.include_in_lodge_guide,
    updated_at = now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_summons_library_document()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_summons_library_document
  ON public.summons;
CREATE TRIGGER sync_summons_library_document
  AFTER INSERT OR UPDATE OF
    title,
    month,
    pdf_url,
    file_name,
    file_size,
    file_type,
    created_by,
    source_mailroom_import_id,
    source_issuer
  ON public.summons
  FOR EACH ROW EXECUTE FUNCTION private.sync_summons_library_document();

-- Existing Mailroom code inserts its source document after the summons. Link
-- that insert to the summons automatically and force all records in the
-- protected category to have a real summons source.
CREATE OR REPLACE FUNCTION private.link_summons_library_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  linked_summons_id uuid;
  summons_category_id uuid;
BEGIN
  SELECT id INTO summons_category_id
  FROM public.document_categories
  WHERE lower(name) = 'summons'
  ORDER BY created_at
  LIMIT 1;

  IF NEW.summons_id IS NULL AND NEW.storage_bucket = 'summons-uploads' THEN
    SELECT summons.id INTO linked_summons_id
    FROM public.summons AS summons
    WHERE (
        NEW.source_mailroom_import_id IS NOT NULL
        AND summons.source_mailroom_import_id = NEW.source_mailroom_import_id
      )
      OR summons.pdf_url = NEW.file_url
    ORDER BY
      (summons.source_mailroom_import_id = NEW.source_mailroom_import_id) DESC,
      summons.created_at
    LIMIT 1;

    IF linked_summons_id IS NOT NULL THEN
      NEW.summons_id := linked_summons_id;
      NEW.category_id := summons_category_id;
      NEW.include_in_lodge_guide := false;
      NEW.rights_reviewed := true;
    END IF;
  END IF;

  IF NEW.category_id = summons_category_id AND NEW.summons_id IS NULL THEN
    RAISE EXCEPTION 'Summons library documents must be published from the Summons section';
  END IF;

  IF NEW.summons_id IS NOT NULL THEN
    NEW.category_id := summons_category_id;
    NEW.storage_bucket := 'summons-uploads';
    NEW.include_in_lodge_guide := false;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.link_summons_library_document()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS link_summons_library_document
  ON public.documents;
CREATE TRIGGER link_summons_library_document
  BEFORE INSERT OR UPDATE OF
    category_id,
    summons_id,
    file_url,
    storage_bucket,
    source_mailroom_import_id
  ON public.documents
  FOR EACH ROW EXECUTE FUNCTION private.link_summons_library_document();

-- Linked summons rows are managed only through the Summons section. Library
-- writers can continue to manage every other document and category.
-- The delegated section policies already include full administrators, so the
-- older duplicate administrator policies are unnecessary.
DROP POLICY IF EXISTS "Admins can create summons" ON public.summons;
DROP POLICY IF EXISTS "Admins can update summons" ON public.summons;
DROP POLICY IF EXISTS "Admins can delete summons" ON public.summons;

DROP POLICY IF EXISTS "Admins can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can update documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can delete documents" ON public.documents;
DROP POLICY IF EXISTS "Library editors can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Library editors can update documents" ON public.documents;
DROP POLICY IF EXISTS "Library editors can delete documents" ON public.documents;
DROP POLICY IF EXISTS "Summons editors can archive summons documents" ON public.documents;

CREATE POLICY "Library editors can insert documents"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_admin_section_permission('library', 'write')
    AND summons_id IS NULL
  );

CREATE POLICY "Library editors can update documents"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (
    public.has_admin_section_permission('library', 'write')
    AND summons_id IS NULL
  )
  WITH CHECK (
    public.has_admin_section_permission('library', 'write')
    AND summons_id IS NULL
  );

CREATE POLICY "Library editors can delete documents"
  ON public.documents FOR DELETE
  TO authenticated
  USING (
    public.has_admin_section_permission('library', 'write')
    AND summons_id IS NULL
  );

DROP POLICY IF EXISTS "Admins can insert categories" ON public.document_categories;
DROP POLICY IF EXISTS "Admins can update categories" ON public.document_categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON public.document_categories;
DROP POLICY IF EXISTS "Library editors can insert categories" ON public.document_categories;
DROP POLICY IF EXISTS "Library editors can update categories" ON public.document_categories;
DROP POLICY IF EXISTS "Library editors can delete categories" ON public.document_categories;

CREATE POLICY "Library editors can insert categories"
  ON public.document_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_admin_section_permission('library', 'write')
    AND lower(name) <> 'summons'
  );

CREATE POLICY "Library editors can update categories"
  ON public.document_categories FOR UPDATE
  TO authenticated
  USING (
    public.has_admin_section_permission('library', 'write')
    AND lower(name) <> 'summons'
  )
  WITH CHECK (
    public.has_admin_section_permission('library', 'write')
    AND lower(name) <> 'summons'
  );

CREATE POLICY "Library editors can delete categories"
  ON public.document_categories FOR DELETE
  TO authenticated
  USING (
    public.has_admin_section_permission('library', 'write')
    AND lower(name) <> 'summons'
  );
