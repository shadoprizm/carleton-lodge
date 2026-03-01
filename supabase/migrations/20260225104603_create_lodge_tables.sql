/*
  # Create Carleton Lodge Database Schema

  1. New Tables
    - `events`
      - `id` (uuid, primary key) - Unique identifier for each event
      - `title` (text) - Event title
      - `description` (text) - Detailed description of the event
      - `event_date` (date) - Date of the event
      - `event_time` (time) - Time of the event
      - `location` (text) - Where the event takes place
      - `created_by` (uuid) - Reference to the user who created the event
      - `created_at` (timestamptz) - When the event was created
      - `updated_at` (timestamptz) - When the event was last updated
    
    - `history_entries`
      - `id` (uuid, primary key) - Unique identifier for each history entry
      - `title` (text) - Title of the history section
      - `content` (text) - History content/story
      - `year` (integer) - Year associated with this history
      - `image_url` (text, optional) - URL to an image for this history entry
      - `display_order` (integer) - Order to display history entries
      - `created_at` (timestamptz) - When the entry was created
      - `updated_at` (timestamptz) - When the entry was last updated

  2. Security
    - Enable RLS on all tables
    - Events: All authenticated users can view events, only authenticated users can create/update
    - History: All users (including public) can view history, only authenticated users can manage
*/

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  event_date date NOT NULL,
  event_time time,
  location text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create history_entries table
CREATE TABLE IF NOT EXISTS history_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  year integer,
  image_url text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE history_entries ENABLE ROW LEVEL SECURITY;

-- Events policies
CREATE POLICY "Anyone can view events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own events"
  ON events FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own events"
  ON events FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- History policies (public can read, authenticated can manage)
CREATE POLICY "Anyone can view history entries"
  ON history_entries FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can create history entries"
  ON history_entries FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update history entries"
  ON history_entries FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete history entries"
  ON history_entries FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS events_date_idx ON events(event_date);
CREATE INDEX IF NOT EXISTS events_created_by_idx ON events(created_by);
CREATE INDEX IF NOT EXISTS history_display_order_idx ON history_entries(display_order);

-- Insert initial history data
INSERT INTO history_entries (title, content, year, display_order) VALUES
  ('The Founding', 'Carleton Lodge 465 is the Masonic Lodge in Carp (West Ottawa). It was founded on January 4, 1904. The initial petition to form a lodge was presented at a meeting of Mississippi Lodge No.147 in Almonte in the fall of 1903. The early support for the lodge came from members of Goodwood Lodge, Mississippi Lodge and Madawaska Lodge. The lodge room, at that time, was located over the drug store in the Kidd Block of Carp.', 1904, 1),
  ('Meeting by Moonlight', 'On October 24, 1904 it was ordered that "the Lodge meet on the Friday night on or before each full moon". This would enable the members to see where they were going when riding on horseback to and from lodge. To truly understand the past, one needs to put it into perspective. Our brethren at the time of the lodge''s founding were getting around by horse and buggy, in a time when fire destroyed 1,500 buildings in Baltimore Maryland in just 30 hours.', 1904, 2),
  ('The Great Fire', 'The original ornaments, furnishings and structure of Carleton Lodge were lost during the great fire of July 20, 1920, that swept through Carp. This devastating event marked a turning point in the lodge''s history, requiring the brethren to rebuild and find a new home.', 1920, 3),
  ('A New Home', 'Following the fire, the Lodge acquired a building that had been the old Presbyterian Church in Carp. The interior of the building holds the furniture from Lodge Le Havre in France that was a military lodge during the First World War. The furniture is beautifully accentuated by the stained glass windows in the building, creating a unique and historic meeting space.', 1920, 4)
ON CONFLICT DO NOTHING;