/*
  # Document Library

  ## Summary
  Creates a full document library system for the lodge. Members can browse
  and download documents. Admins (and users with the "librarian" flag) can
  upload, edit, and delete documents and folders.

  ## New Tables

  ### document_categories
  Organises documents into labelled folders/sections.
  - id (uuid PK)
  - name (text) — display name, e.g. "Minutes", "By-Laws"
  - description (text nullable)
  - display_order (int) — sidebar/grid ordering
  - created_at, updated_at

  ### documents
  Each uploaded or linked document.
  - id (uuid PK)
  - category_id (uuid FK → document_categories)
  - title (text)
  - description (text nullable)
  - file_url (text) — storage path or external URL
  - file_name (text) — original file name
  - file_size (bigint nullable) — bytes
  - file_type (text nullable) — MIME type e.g. "application/pdf"
  - tags (text[]) — optional searchable tags
  - uploaded_by (uuid FK → auth.users nullable)
  - created_at, updated_at

  ## Security
  - RLS enabled on both tables
  - Only authenticated users can read (members-only library)
  - Only admins can insert/update/delete
*/

CREATE TABLE IF NOT EXISTS document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated members can view categories"
  ON document_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert categories"
  ON document_categories FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update categories"
  ON document_categories FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete categories"
  ON document_categories FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES document_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  file_type text,
  tags text[] DEFAULT '{}',
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated members can view documents"
  ON documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete documents"
  ON documents FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_document_categories_updated_at') THEN
    CREATE TRIGGER update_document_categories_updated_at
      BEFORE UPDATE ON document_categories
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_documents_updated_at') THEN
    CREATE TRIGGER update_documents_updated_at
      BEFORE UPDATE ON documents
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

INSERT INTO document_categories (name, description, display_order) VALUES
  ('Minutes', 'Meeting minutes and records', 1),
  ('By-Laws & Regulations', 'Lodge constitutions, by-laws, and standing orders', 2),
  ('Notices & Summons', 'Archived summons and official notices', 3),
  ('Financial Records', 'Annual reports and financial statements', 4),
  ('Correspondence', 'Official lodge correspondence', 5),
  ('Miscellaneous', 'Other lodge documents', 6)
ON CONFLICT DO NOTHING;
