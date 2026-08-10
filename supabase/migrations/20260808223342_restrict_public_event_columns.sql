-- Apply after the frontend has stopped using SELECT * for public calendars.
-- Public users receive only safe columns; point-of-contact and creator
-- identifiers remain available to signed-in members and event editors.
REVOKE SELECT ON carletonlodge.events FROM anon;
GRANT SELECT (
  id,
  title,
  description,
  event_date,
  event_time,
  event_end_time,
  location,
  location_address,
  visibility,
  event_status,
  status_note,
  created_at,
  updated_at
) ON carletonlodge.events TO anon;
