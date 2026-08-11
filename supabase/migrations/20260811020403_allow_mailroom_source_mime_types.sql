/*
  # Permit the private summons bucket to retain Mailroom source material

  Intelligent Mailroom drafts preserve their original supported attachments and
  an email-body provenance copy under the `mailroom/` prefix. The bucket remains
  private and existing RLS policies continue to control access.
*/

UPDATE storage.buckets
SET
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]::text[]
WHERE id = 'summons-uploads';
