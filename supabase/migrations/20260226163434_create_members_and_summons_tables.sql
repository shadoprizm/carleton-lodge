/*
  # Create Members Directory and Summons System

  1. New Tables
    - `lodge_positions`
      - `id` (uuid, primary key)
      - `name` (text) - Position name (e.g., "Worshipful Master", "Senior Warden")
      - `display_order` (integer) - Order to display positions
      - `created_at` (timestamptz)
    
    - `member_profiles`
      - `id` (uuid, primary key) - References profiles(id)
      - `full_name` (text) - Member's full name
      - `phone` (text) - Phone number
      - `address` (text) - Mailing address
      - `join_date` (date) - Date joined the lodge
      - `position_id` (uuid) - References lodge_positions(id)
      - `bio` (text) - Optional biography
      - `visible_to_members` (boolean) - Whether profile is visible to other members
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `summons`
      - `id` (uuid, primary key)
      - `title` (text) - Summons title
      - `month` (text) - Month/year (e.g., "January 2024")
      - `content` (text) - Full summons content
      - `pdf_url` (text) - Optional PDF attachment URL
      - `published_at` (timestamptz) - When summons was published
      - `created_by` (uuid) - References auth.users(id)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `notification_preferences`
      - `id` (uuid, primary key) - References profiles(id)
      - `email_notifications` (boolean) - Opt-in for email notifications
      - `notify_new_summons` (boolean) - Notify when new summons posted
      - `notify_new_events` (boolean) - Notify when new events created
      - `notify_event_updates` (boolean) - Notify when events are updated
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Members can view other members' profiles if visible_to_members is true
    - Only admins can create/update/delete member profiles
    - Only admins can create/update/delete summons
    - Authenticated users can view published summons
    - Users can manage their own notification preferences

  3. Indexes
    - Index on member_profiles.position_id for efficient lookups
    - Index on summons.published_at for chronological ordering
*/

-- Create lodge positions table
CREATE TABLE IF NOT EXISTS lodge_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create member profiles table
CREATE TABLE IF NOT EXISTS member_profiles (
  id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  address text,
  join_date date,
  position_id uuid REFERENCES lodge_positions(id) ON DELETE SET NULL,
  bio text,
  visible_to_members boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create summons table
CREATE TABLE IF NOT EXISTS summons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  month text NOT NULL,
  content text NOT NULL,
  pdf_url text,
  published_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email_notifications boolean DEFAULT false,
  notify_new_summons boolean DEFAULT true,
  notify_new_events boolean DEFAULT true,
  notify_event_updates boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE lodge_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE summons ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Lodge positions policies
CREATE POLICY "Anyone can view positions"
  ON lodge_positions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage positions"
  ON lodge_positions FOR ALL
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

-- Member profiles policies
CREATE POLICY "Members can view visible profiles"
  ON member_profiles FOR SELECT
  TO authenticated
  USING (visible_to_members = true);

CREATE POLICY "Users can view own profile"
  ON member_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all member profiles"
  ON member_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert member profiles"
  ON member_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update member profiles"
  ON member_profiles FOR UPDATE
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

CREATE POLICY "Admins can delete member profiles"
  ON member_profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Summons policies
CREATE POLICY "Authenticated users can view summons"
  ON summons FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can create summons"
  ON summons FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update summons"
  ON summons FOR UPDATE
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

CREATE POLICY "Admins can delete summons"
  ON summons FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Notification preferences policies
CREATE POLICY "Users can view own notification preferences"
  ON notification_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own notification preferences"
  ON notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own notification preferences"
  ON notification_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create indexes
CREATE INDEX IF NOT EXISTS member_profiles_position_id_idx ON member_profiles(position_id);
CREATE INDEX IF NOT EXISTS summons_published_at_idx ON summons(published_at DESC);
CREATE INDEX IF NOT EXISTS notification_preferences_email_enabled_idx ON notification_preferences(email_notifications) WHERE email_notifications = true;

-- Function to create notification preferences on profile creation
CREATE OR REPLACE FUNCTION handle_new_profile_notifications()
RETURNS trigger AS $$
BEGIN
  INSERT INTO notification_preferences (id, email_notifications, notify_new_summons, notify_new_events)
  VALUES (NEW.id, false, true, true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call function on profile creation
DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_profile_notifications();

-- Insert some default positions
INSERT INTO lodge_positions (name, display_order) VALUES
  ('Worshipful Master', 1),
  ('Senior Warden', 2),
  ('Junior Warden', 3),
  ('Treasurer', 4),
  ('Secretary', 5),
  ('Senior Deacon', 6),
  ('Junior Deacon', 7),
  ('Senior Steward', 8),
  ('Junior Steward', 9),
  ('Tyler', 10),
  ('Chaplain', 11),
  ('Member', 99)
ON CONFLICT DO NOTHING;
