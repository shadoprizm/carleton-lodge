/*
  # Create Lodge Members Roster Table

  This introduces a standalone `lodge_members` table that represents the lodge's
  membership roster independently of any Supabase auth account.

  ## Purpose
  Admins can add any member by name and position without requiring that person
  to have a login account. Later, a `linked_profile_id` column can be used to
  optionally associate a roster entry with a registered user account.

  ## New Tables
  - `lodge_members`
    - `id` (uuid, primary key, auto-generated)
    - `full_name` (text, required) - Member's display name
    - `phone` (text, nullable) - Contact phone number
    - `address` (text, nullable) - Mailing address
    - `join_date` (date, nullable) - Date the member joined the lodge
    - `position_id` (uuid, nullable) - FK to lodge_positions(id)
    - `bio` (text, nullable) - Optional biography
    - `visible_to_members` (boolean, default true) - Controls directory visibility
    - `linked_profile_id` (uuid, nullable) - Optional FK to profiles(id) for future account linking
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated members can view entries where visible_to_members = true
  - Admins can view, insert, update, and delete all entries

  ## Notes
  - The existing `member_profiles` table is left untouched
  - `lodge_members` has its own auto-generated UUID so no auth account is needed
  - `linked_profile_id` is nullable and has no ON DELETE CASCADE so unlinking an
    account never removes the roster entry
*/

CREATE TABLE IF NOT EXISTS lodge_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text,
  address text,
  join_date date,
  position_id uuid REFERENCES lodge_positions(id) ON DELETE SET NULL,
  bio text,
  visible_to_members boolean DEFAULT true,
  linked_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE lodge_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS lodge_members_position_id_idx ON lodge_members(position_id);
CREATE INDEX IF NOT EXISTS lodge_members_linked_profile_id_idx ON lodge_members(linked_profile_id);

CREATE POLICY "Members can view visible lodge members"
  ON lodge_members FOR SELECT
  TO authenticated
  USING (visible_to_members = true);

CREATE POLICY "Admins can view all lodge members"
  ON lodge_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert lodge members"
  ON lodge_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update lodge members"
  ON lodge_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete lodge members"
  ON lodge_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
