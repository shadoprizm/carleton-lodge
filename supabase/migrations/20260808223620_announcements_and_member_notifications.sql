-- A first-class notice board replaces scattered one-off emails as the source
-- of truth. Email remains an optional delivery channel that points back here.

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 10000),
  priority text NOT NULL DEFAULT 'normal' CHECK (
    priority IN ('normal', 'important', 'urgent')
  ),
  visibility text NOT NULL DEFAULT 'members' CHECK (
    visibility IN ('public', 'members')
  ),
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT announcements_publication_state CHECK (
    (is_published = false AND published_at IS NULL)
    OR (is_published = true AND published_at IS NOT NULL)
  ),
  CONSTRAINT announcements_expiry_order CHECK (
    expires_at IS NULL OR published_at IS NULL OR expires_at > published_at
  )
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS announcements_active_idx
  ON public.announcements(is_published, visibility, published_at DESC)
  WHERE is_published = true;

DROP TRIGGER IF EXISTS update_announcements_updated_at
  ON public.announcements;
CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT ON public.announcements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO service_role;

DROP POLICY IF EXISTS "Public can view active public announcements"
  ON public.announcements;
CREATE POLICY "Public can view active public announcements"
  ON public.announcements FOR SELECT
  TO anon
  USING (
    is_published = true
    AND visibility = 'public'
    AND (expires_at IS NULL OR expires_at > now())
  );

DROP POLICY IF EXISTS "Members can view active announcements"
  ON public.announcements;
CREATE POLICY "Members can view active announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (
    is_published = true
    AND visibility IN ('public', 'members')
    AND (expires_at IS NULL OR expires_at > now())
  );

DROP POLICY IF EXISTS "Communications readers can view all announcements"
  ON public.announcements;
CREATE POLICY "Communications readers can view all announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (public.has_admin_section_permission('communications', 'read'));

DROP POLICY IF EXISTS "Communications writers can create announcements"
  ON public.announcements;
CREATE POLICY "Communications writers can create announcements"
  ON public.announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND public.has_admin_section_permission('communications', 'write')
  );

DROP POLICY IF EXISTS "Communications writers can update announcements"
  ON public.announcements;
CREATE POLICY "Communications writers can update announcements"
  ON public.announcements FOR UPDATE
  TO authenticated
  USING (public.has_admin_section_permission('communications', 'write'))
  WITH CHECK (public.has_admin_section_permission('communications', 'write'));

DROP POLICY IF EXISTS "Communications writers can delete announcements"
  ON public.announcements;
CREATE POLICY "Communications writers can delete announcements"
  ON public.announcements FOR DELETE
  TO authenticated
  USING (public.has_admin_section_permission('communications', 'write'));

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS notify_announcements boolean NOT NULL DEFAULT true;

-- Queue new-event and material event-update emails for members who explicitly
-- enabled each preference. Admin-only events never leave the admin audience.
CREATE OR REPLACE FUNCTION carletonlodge_private.enqueue_member_event_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  recipient record;
  message_type text;
  message_key text;
BEGIN
  IF NEW.visibility = 'admin' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    message_type := 'new_event';
    message_key := 'new-event:' || NEW.id;
  ELSE
    message_type := 'event_updated';
    message_key := 'event-update:' || NEW.id || ':' || extract(epoch FROM NEW.updated_at)::text;
  END IF;

  FOR recipient IN
    SELECT preferences.id, profiles.email
    FROM public.notification_preferences AS preferences
    JOIN public.profiles AS profiles ON profiles.id = preferences.id
    WHERE preferences.email_notifications = true
      AND (
        (TG_OP = 'INSERT' AND preferences.notify_new_events = true)
        OR (TG_OP = 'UPDATE' AND preferences.notify_event_updates = true)
      )
  LOOP
    INSERT INTO public.notification_outbox (
      notification_type,
      recipient_profile_id,
      recipient_email,
      payload,
      idempotency_key
    )
    VALUES (
      message_type,
      recipient.id,
      recipient.email,
      jsonb_build_object(
        'event_id', NEW.id,
        'title', NEW.title,
        'event_date', NEW.event_date,
        'event_time', NEW.event_time,
        'location', NEW.location,
        'event_status', NEW.event_status,
        'status_note', NEW.status_note
      ),
      message_key || ':' || recipient.id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge_private.enqueue_member_event_notifications()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enqueue_member_event_notifications
  ON public.events;
CREATE TRIGGER enqueue_member_event_notifications
  AFTER INSERT OR UPDATE OF
    title,
    description,
    event_date,
    event_time,
    event_end_time,
    location,
    location_address,
    visibility,
    event_status,
    status_note
  ON public.events
  FOR EACH ROW EXECUTE FUNCTION carletonlodge_private.enqueue_member_event_notifications();

CREATE OR REPLACE FUNCTION carletonlodge_private.enqueue_announcement_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  recipient record;
BEGIN
  IF NEW.is_published = false
    OR (TG_OP = 'UPDATE' AND OLD.is_published = true) THEN
    RETURN NEW;
  END IF;

  FOR recipient IN
    SELECT preferences.id, profiles.email
    FROM public.notification_preferences AS preferences
    JOIN public.profiles AS profiles ON profiles.id = preferences.id
    WHERE preferences.email_notifications = true
      AND preferences.notify_announcements = true
  LOOP
    INSERT INTO public.notification_outbox (
      notification_type,
      recipient_profile_id,
      recipient_email,
      payload,
      idempotency_key
    )
    VALUES (
      'new_announcement',
      recipient.id,
      recipient.email,
      jsonb_build_object(
        'announcement_id', NEW.id,
        'title', NEW.title,
        'body', NEW.body,
        'priority', NEW.priority
      ),
      'new-announcement:' || NEW.id || ':' || recipient.id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge_private.enqueue_announcement_notifications()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enqueue_announcement_notifications
  ON public.announcements;
CREATE TRIGGER enqueue_announcement_notifications
  AFTER INSERT OR UPDATE OF is_published ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION carletonlodge_private.enqueue_announcement_notifications();
