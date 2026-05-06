/*
  # Create Event Assets Storage Bucket

  Adds a public storage bucket for event posters, images, and linked files that
  can be embedded directly inside rich event descriptions.

  - Public read access so event descriptions can render for visitors
  - Authenticated members can upload into their own folder
  - Owners and admins can update or delete uploaded assets
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-assets',
  'event-assets',
  true,
  26214400,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/webp',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view event assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload event assets" ON storage.objects;
DROP POLICY IF EXISTS "Owners or admins can update event assets" ON storage.objects;
DROP POLICY IF EXISTS "Owners or admins can delete event assets" ON storage.objects;

CREATE POLICY "Anyone can view event assets"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'event-assets');

CREATE POLICY "Authenticated users can upload event assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-assets' AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = (select auth.uid())
          AND profiles.is_admin = true
      )
    )
  );

CREATE POLICY "Owners or admins can update event assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'event-assets' AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = (select auth.uid())
          AND profiles.is_admin = true
      )
    )
  )
  WITH CHECK (
    bucket_id = 'event-assets' AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = (select auth.uid())
          AND profiles.is_admin = true
      )
    )
  );

CREATE POLICY "Owners or admins can delete event assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-assets' AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = (select auth.uid())
          AND profiles.is_admin = true
      )
    )
  );
