/*
  # Create Summons Storage Bucket

  1. Storage
    - Creates a `summons-uploads` bucket for storing summons PDF/text files
    - Files are accessible only to authenticated users
    - Admins can upload files; authenticated users can read

  2. Security
    - Read access: authenticated users only
    - Write/delete access: admin users only (checked via profiles table)
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('summons-uploads', 'summons-uploads', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can read summons uploads"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'summons-uploads');

CREATE POLICY "Admins can upload summons files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'summons-uploads' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete summons files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'summons-uploads' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );
