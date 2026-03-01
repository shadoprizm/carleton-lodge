/*
  # Add Email Field and Auto-Link to Lodge Members

  ## Summary
  Adds an optional email address to the lodge_members roster so that when a
  member eventually creates an account, the system can automatically link their
  auth profile to their existing roster entry.

  ## Changes

  ### Modified Tables
  - `lodge_members`
    - New column: `email` (text, nullable, unique) - The email address the admin
      enters when setting up the roster entry. Used as the match key for
      auto-linking when the person signs in.

  ### Modified Functions
  - `handle_new_user()` - Extended to attempt auto-linking: after creating a
    profile row, it checks whether any unlinked lodge_members row has a matching
    email and, if so, sets linked_profile_id on that row.

  ## Notes
  - email is unique on lodge_members so one roster entry cannot be linked to
    multiple accounts via email match
  - The link only fires on first sign-up (INSERT on auth.users); updating an
    email later does NOT re-trigger the match
  - Admins can still manually link or unlink at any time through the admin UI
  - An index is added on lodge_members(email) for fast lookups during sign-in
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lodge_members' AND column_name = 'email'
  ) THEN
    ALTER TABLE lodge_members ADD COLUMN email text;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS lodge_members_email_unique_idx
  ON lodge_members(email)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS lodge_members_email_idx ON lodge_members(email);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_admin, created_at)
  VALUES (NEW.id, NEW.email, false, now())
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.lodge_members
  SET linked_profile_id = NEW.id
  WHERE email = NEW.email
    AND linked_profile_id IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
