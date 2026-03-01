/*
  # Create Photo Gallery System

  ## Summary
  Creates a full photo gallery system with album-level and per-photo permission controls.

  ## New Tables

  ### photo_albums
  - `id` (uuid, primary key)
  - `title` (text) - Album name
  - `description` (text, nullable) - Album description
  - `cover_photo_id` (uuid, nullable) - Reference to cover photo
  - `visibility` (text) - 'public', 'members', or 'admin'
  - `created_by` (uuid) - Admin who created it
  - `created_at`, `updated_at` (timestamps)

  ### photos
  - `id` (uuid, primary key)
  - `album_id` (uuid, FK to photo_albums)
  - `title` (text, nullable) - Optional photo title
  - `description` (text, nullable) - Optional caption/description
  - `storage_path` (text) - Path in Supabase storage
  - `public_url` (text) - Publicly accessible URL
  - `original_filename` (text) - Original file name
  - `file_size` (bigint) - File size in bytes
  - `width` (int) - Image width in px
  - `height` (int) - Image height in px
  - `taken_at` (date, nullable) - Date photo was taken
  - `visibility` (text) - Overrides album visibility if set: 'public', 'members', 'admin', or 'inherit'
  - `uploaded_by` (uuid) - Admin who uploaded it
  - `display_order` (int) - Sort order within album
  - `created_at`, `updated_at` (timestamps)

  ## Security
  - RLS enabled on both tables
  - Public visibility: anyone can view
  - Members visibility: authenticated users only
  - Admin visibility: only admins
  - Only admins can insert/update/delete
*/

CREATE TABLE IF NOT EXISTS photo_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  cover_photo_id uuid,
  visibility text NOT NULL DEFAULT 'members' CHECK (visibility IN ('public', 'members', 'admin')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid REFERENCES photo_albums(id) ON DELETE CASCADE,
  title text,
  description text,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  original_filename text NOT NULL DEFAULT '',
  file_size bigint DEFAULT 0,
  width int DEFAULT 0,
  height int DEFAULT 0,
  taken_at date,
  visibility text NOT NULL DEFAULT 'inherit' CHECK (visibility IN ('public', 'members', 'admin', 'inherit')),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE photo_albums ADD CONSTRAINT fk_cover_photo
  FOREIGN KEY (cover_photo_id) REFERENCES photos(id) ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE photo_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION effective_photo_visibility(photo_visibility text, album_visibility text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE WHEN photo_visibility = 'inherit' THEN album_visibility ELSE photo_visibility END;
$$;

CREATE POLICY "Public can view public albums"
  ON photo_albums FOR SELECT
  TO anon
  USING (visibility = 'public');

CREATE POLICY "Members can view public and member albums"
  ON photo_albums FOR SELECT
  TO authenticated
  USING (
    visibility IN ('public', 'members') OR
    (visibility = 'admin' AND EXISTS (
      SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    ))
  );

CREATE POLICY "Admins can insert albums"
  ON photo_albums FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

CREATE POLICY "Admins can update albums"
  ON photo_albums FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

CREATE POLICY "Admins can delete albums"
  ON photo_albums FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

CREATE POLICY "Public can view photos in public albums"
  ON photos FOR SELECT
  TO anon
  USING (
    effective_photo_visibility(visibility, (
      SELECT visibility FROM photo_albums WHERE id = album_id
    )) = 'public'
  );

CREATE POLICY "Members can view photos based on visibility"
  ON photos FOR SELECT
  TO authenticated
  USING (
    effective_photo_visibility(visibility, (
      SELECT visibility FROM photo_albums WHERE id = album_id
    )) IN ('public', 'members') OR
    (
      effective_photo_visibility(visibility, (
        SELECT visibility FROM photo_albums WHERE id = album_id
      )) = 'admin' AND
      EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
    )
  );

CREATE POLICY "Admins can insert photos"
  ON photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

CREATE POLICY "Admins can update photos"
  ON photos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

CREATE POLICY "Admins can delete photos"
  ON photos FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

CREATE OR REPLACE FUNCTION update_photo_albums_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION update_photos_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER photo_albums_updated_at BEFORE UPDATE ON photo_albums
  FOR EACH ROW EXECUTE FUNCTION update_photo_albums_updated_at();

CREATE TRIGGER photos_updated_at BEFORE UPDATE ON photos
  FOR EACH ROW EXECUTE FUNCTION update_photos_updated_at();
