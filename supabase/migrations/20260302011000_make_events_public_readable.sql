/*
  # Make events publicly readable

  1. Security Changes
    - Replace the `events` SELECT policy so unauthenticated visitors can read events
    - Keep write operations restricted to authenticated/admin policies
*/

DROP POLICY IF EXISTS "Anyone can view events" ON public.events;

CREATE POLICY "Anyone can view events"
  ON public.events FOR SELECT
  TO anon, authenticated
  USING (true);
