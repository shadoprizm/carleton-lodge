/*
  # Documents Storage Bucket

  Creates a private storage bucket for lodge document files.
  Only authenticated users can read. Only admins can upload/delete.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lodge-documents',
  'lodge-documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated members can read documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'lodge-documents');

CREATE POLICY "Admins can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'lodge-documents' AND public.is_admin());

CREATE POLICY "Admins can delete documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'lodge-documents' AND public.is_admin());

CREATE POLICY "Admins can update documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'lodge-documents' AND public.is_admin())
  WITH CHECK (bucket_id = 'lodge-documents' AND public.is_admin());
