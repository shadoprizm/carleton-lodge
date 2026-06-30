/*
  # Add baked cover image to photo albums

  ## Summary
  Adds support for an album "avatar" that is a cropped region of a photo rather than a
  whole photo centre-cropped by CSS. The admin selects a portion of an existing album
  photo; the cropped result is baked to a WebP and stored in the `lodge-photos` bucket,
  and the album points at it via the columns below.

  ## Changes
  - `carletonlodge.photo_albums.cover_image_url`  (text) - public URL of the baked cover
  - `carletonlodge.photo_albums.cover_image_path` (text) - storage path, so the file can
    be replaced/removed when the cover changes or the album is deleted

  The existing `cover_photo_id` is retained: it records which photo the crop came from
  (drives the "Cover" badge) and remains the fallback when no baked cover exists.

  ## Notes
  This site shares a Supabase project with other apps; its objects live in the
  `carletonlodge` schema. No new RLS or storage policy is required — the existing
  album UPDATE policy and `lodge-photos` storage policies already cover this.
*/

ALTER TABLE carletonlodge.photo_albums
  ADD COLUMN IF NOT EXISTS cover_image_url  text,
  ADD COLUMN IF NOT EXISTS cover_image_path text;
