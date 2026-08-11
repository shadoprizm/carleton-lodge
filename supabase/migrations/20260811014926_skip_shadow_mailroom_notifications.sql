-- Shadow runs validate classification without creating operational review noise.
CREATE OR REPLACE FUNCTION carletonlodge_private.enqueue_mailroom_review_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE recipient record;
BEGIN
  IF NEW.status <> 'needs_review'
    OR OLD.status = 'needs_review'
    OR NEW.processing_mode = 'shadow'
  THEN
    RETURN NEW;
  END IF;

  FOR recipient IN
    SELECT DISTINCT profiles.id, profiles.email
    FROM public.profiles
    LEFT JOIN public.admin_section_permissions AS permission
      ON permission.profile_id = profiles.id AND permission.section = 'communications'
    WHERE profiles.email IS NOT NULL
      AND (profiles.is_admin = true OR permission.can_write = true)
  LOOP
    INSERT INTO public.notification_outbox (
      notification_type, recipient_profile_id, recipient_email, payload, idempotency_key
    ) VALUES (
      'mailroom_draft_ready', recipient.id, recipient.email,
      jsonb_build_object('import_id', NEW.id, 'summary', NEW.summary,
        'source_issuer', NEW.source_issuer, 'processing_mode', NEW.processing_mode,
        'classification_tags', NEW.classification_tags),
      'mailroom-draft-ready:' || NEW.id || ':' || recipient.id
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge_private.enqueue_mailroom_review_notification()
  FROM PUBLIC, anon, authenticated;
