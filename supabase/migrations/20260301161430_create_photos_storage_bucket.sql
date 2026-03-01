/*
  # Create Photos Storage Bucket

  ## Summary
  Creates a public storage bucket for lodge photo gallery images.
  Photos are stored as WebP after client-side conversion.
  The bucket is public so public-visibility photos can be served directly via URL.

  ## Storage Policies
  - Anyone (anon) can read from the bucket (URL-based access control is handled by DB RLS)
  - Only admins can upload, update, or delete photos
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lodge-photos',
  'lodge-photos',
  true,
  10485760,
  ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view lodge photos"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'lodge-photos');

CREATE POLICY "Authenticated users can view lodge photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'lodge-photos');

CREATE POLICY "Admins can upload photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lodge-photos' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'lodge-photos' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    bucket_id = 'lodge-photos' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lodge-photos' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );
