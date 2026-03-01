/*
  # Add storage_bucket column to documents table

  ## Summary
  Adds a `storage_bucket` column to the `documents` table so that documents
  originating from different storage buckets (e.g. summons-uploads vs lodge-documents)
  can be correctly resolved when generating signed URLs.

  ## Changes
  - `documents`: new nullable column `storage_bucket` (text), defaults to 'lodge-documents'

  ## Notes
  - Existing rows will remain unaffected (NULL resolves to default 'lodge-documents' in application code)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'storage_bucket'
  ) THEN
    ALTER TABLE documents ADD COLUMN storage_bucket text DEFAULT 'lodge-documents';
  END IF;
END $$;
