/*
  # Create History Timeline Tables

  1. New Tables
    - `history_eras`
      - `id` (uuid, primary key)
      - `title` (text) - Era title (e.g., "The Formative Era")
      - `year_start` (int) - Starting year
      - `year_end` (int) - Ending year (can be current)
      - `slug` (text, unique) - URL-friendly identifier
      - `summary` (text) - Brief description
      - `content` (text) - Full historical content
      - `image_url` (text) - Hero image for the era
      - `display_order` (int) - Order in timeline
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `history_milestones`
      - `id` (uuid, primary key)
      - `era_id` (uuid, foreign key to history_eras)
      - `title` (text) - Milestone title
      - `date` (date) - Specific date
      - `description` (text) - Description
      - `image_url` (text) - Optional image
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Public read access
    - Admin-only write access
*/

CREATE TABLE IF NOT EXISTS history_eras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  year_start int NOT NULL,
  year_end int,
  slug text UNIQUE NOT NULL,
  summary text NOT NULL,
  content text NOT NULL,
  image_url text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS history_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  era_id uuid REFERENCES history_eras(id) ON DELETE CASCADE,
  title text NOT NULL,
  date date NOT NULL,
  description text NOT NULL,
  image_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE history_eras ENABLE ROW LEVEL SECURITY;
ALTER TABLE history_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view history eras"
  ON history_eras FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can view history milestones"
  ON history_milestones FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert history eras"
  ON history_eras FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update history eras"
  ON history_eras FOR UPDATE
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

CREATE POLICY "Admins can delete history eras"
  ON history_eras FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert history milestones"
  ON history_milestones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update history milestones"
  ON history_milestones FOR UPDATE
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

CREATE POLICY "Admins can delete history milestones"
  ON history_milestones FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_history_eras_slug ON history_eras(slug);
CREATE INDEX IF NOT EXISTS idx_history_eras_display_order ON history_eras(display_order);
CREATE INDEX IF NOT EXISTS idx_history_milestones_era_id ON history_milestones(era_id);
CREATE INDEX IF NOT EXISTS idx_history_milestones_date ON history_milestones(date);