/*
  # Add end time and point of contact fields to events

  1. Modified Tables
    - `events`
      - `event_end_time` (time, nullable) - optional end time for the event
      - `poc_name` (text, nullable) - point of contact name
      - `poc_contact` (text, nullable) - point of contact phone or email

  2. Notes
    - All new columns are optional (nullable)
    - No breaking changes to existing records
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'event_end_time'
  ) THEN
    ALTER TABLE events ADD COLUMN event_end_time time;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'poc_name'
  ) THEN
    ALTER TABLE events ADD COLUMN poc_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'poc_contact'
  ) THEN
    ALTER TABLE events ADD COLUMN poc_contact text;
  END IF;
END $$;
