-- Separate public calendar information from member and administrative events,
-- and make changes such as cancellations explicit instead of silently editing
-- or deleting an event.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS event_status text NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS status_note text;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_visibility_check,
  ADD CONSTRAINT events_visibility_check
    CHECK (visibility IN ('public', 'members', 'admin')),
  DROP CONSTRAINT IF EXISTS events_event_status_check,
  ADD CONSTRAINT events_event_status_check
    CHECK (event_status IN ('scheduled', 'cancelled', 'postponed')),
  DROP CONSTRAINT IF EXISTS events_status_note_check,
  ADD CONSTRAINT events_status_note_check
    CHECK (status_note IS NULL OR length(status_note) <= 500);

CREATE INDEX IF NOT EXISTS events_visibility_date_idx
  ON public.events(visibility, event_date);

ALTER TABLE public.event_submissions
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'members';

ALTER TABLE public.event_submissions
  DROP CONSTRAINT IF EXISTS event_submissions_visibility_check,
  ADD CONSTRAINT event_submissions_visibility_check
    CHECK (visibility IN ('public', 'members', 'admin'));

-- Approved submissions inherit the audience selected during review.
CREATE OR REPLACE FUNCTION carletonlodge_private.prepare_event_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_user_email text;
  new_event_id uuid;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'An authenticated lodge member is required';
  END IF;

  SELECT email
  INTO current_user_email
  FROM public.profiles
  WHERE id = current_user_id;

  IF current_user_email IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'A Carleton Lodge member profile is required';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := current_user_id;
    NEW.submitter_email := current_user_email;
    NEW.status := 'pending';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.review_notes := NULL;
    NEW.published_event_id := NULL;
    NEW.created_at := now();
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  NEW.created_by := OLD.created_by;
  NEW.submitter_email := OLD.submitter_email;
  NEW.created_at := OLD.created_at;
  NEW.published_event_id := OLD.published_event_id;

  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'Reviewed event submissions are immutable';
  END IF;

  IF NEW.status = 'pending' THEN
    IF current_user_id <> OLD.created_by
      AND NOT public.has_admin_section_permission('events', 'write') THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'You are not allowed to edit this event submission';
    END IF;

    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.review_notes := NULL;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('approved', 'rejected')
    OR NOT public.has_admin_section_permission('events', 'approve') THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Event approval permission is required';
  END IF;

  NEW.reviewed_by := current_user_id;
  NEW.reviewed_at := now();
  NEW.updated_at := now();

  IF NEW.status = 'approved' THEN
    INSERT INTO public.events (
      title,
      description,
      event_date,
      event_time,
      event_end_time,
      location,
      location_address,
      poc_name,
      poc_contact,
      visibility,
      created_by
    )
    VALUES (
      btrim(NEW.title),
      NEW.description,
      NEW.event_date,
      NEW.event_time,
      NEW.event_end_time,
      btrim(NEW.location),
      NULLIF(btrim(NEW.location_address), ''),
      NULLIF(btrim(NEW.poc_name), ''),
      NULLIF(btrim(NEW.poc_contact), ''),
      NEW.visibility,
      NEW.created_by
    )
    RETURNING id INTO new_event_id;

    NEW.published_event_id := new_event_id;
  ELSE
    NEW.published_event_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge_private.prepare_event_submission()
  FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Anyone can view events" ON public.events;
DROP POLICY IF EXISTS "Public can view public events" ON public.events;
DROP POLICY IF EXISTS "Members can view lodge events" ON public.events;
DROP POLICY IF EXISTS "Event managers can view all events" ON public.events;

CREATE POLICY "Public can view public events"
  ON public.events FOR SELECT
  TO anon
  USING (visibility = 'public');

CREATE POLICY "Members can view lodge events"
  ON public.events FOR SELECT
  TO authenticated
  USING (visibility IN ('public', 'members'));

CREATE POLICY "Event managers can view all events"
  ON public.events FOR SELECT
  TO authenticated
  USING (public.has_admin_section_permission('events', 'read'));
