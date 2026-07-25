/*
  # Make the photo bucket private  (SEC-5)

  ## Problem
  `lodge-photos` was a public bucket. Album/photo `visibility` therefore only
  hid rows in the UI — the bytes stayed world-readable at their public URL, so
  a members-only album was fully retrievable by anyone who had (or guessed) the
  object path. Today every photo in the project lives in a `members` album, so
  all of them are exposed.

  ## Approach
  Flip the bucket to private and add a storage read policy that mirrors the
  rules already enforced on `photos` / `photo_albums`.

  The policy deliberately does NOT restate the visibility logic. It only asks
  "is there a row pointing at this object that the caller is allowed to SELECT?"
  and lets the existing RLS on those tables decide. Because the policy runs as
  the invoker, `anon` only matches photos in public albums, members match
  public + members albums, and gallery readers/admins match everything —
  including the `effective_photo_visibility()` handling of `inherit`. One
  source of truth, so storage access can never drift from row access.

  Reads now go through signed URLs (the same pattern the document library and
  summons already use); the frontend mints them in the gallery loaders.

  Schema note: written against `public` — the dedicated project's schema.
*/

UPDATE storage.buckets SET public = false WHERE id = 'lodge-photos';

DROP POLICY IF EXISTS "Lodge photos follow row visibility" ON storage.objects;

CREATE POLICY "Lodge photos follow row visibility"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'lodge-photos'
    AND (
      -- a photo the caller is allowed to see
      EXISTS (
        SELECT 1 FROM public.photos p
        WHERE p.storage_path = name
      )
      -- or the album's baked cover crop, which lives outside the photos table
      OR EXISTS (
        SELECT 1 FROM public.photo_albums a
        WHERE a.cover_image_path = name
      )
    )
  );
