/*
  # Add location_address to events table

  ## Summary
  Adds a `location_address` column to the `events` table to store a full street address
  that can be used to generate a Google Maps link. The existing `location` column
  remains as the display name (e.g., "Carleton Lodge Hall") while `location_address`
  stores the full address (e.g., "123 Main St, Ottawa, ON K1A 0A1").

  ## Changes
  - `events` table: new nullable `location_address` (text) column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'location_address'
  ) THEN
    ALTER TABLE events ADD COLUMN location_address text;
  END IF;
END $$;
