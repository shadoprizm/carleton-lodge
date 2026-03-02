/*
  # Make events.description nullable

  ## Why
  Event descriptions are optional in the UI. Allowing NULL here prevents
  inserts/updates from failing when a client sends null for this field.
*/

ALTER TABLE public.events
  ALTER COLUMN description DROP NOT NULL;
