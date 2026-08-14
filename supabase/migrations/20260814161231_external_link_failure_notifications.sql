/*
  # One-time external-link failure notifications

  A link key can be inserted only once. The insert and its email-outbox job are
  committed together, so concurrent visitors cannot produce duplicate email.
*/

CREATE TABLE public.external_link_alerts (
  link_key text PRIMARY KEY,
  link_name text NOT NULL,
  target_url text NOT NULL,
  failure_reason text NOT NULL,
  first_failed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_link_alerts_key_check
    CHECK (link_key ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  CONSTRAINT external_link_alerts_name_check
    CHECK (char_length(link_name) BETWEEN 1 AND 160),
  CONSTRAINT external_link_alerts_url_check
    CHECK (char_length(target_url) BETWEEN 9 AND 2048 AND target_url ~ '^https://'),
  CONSTRAINT external_link_alerts_reason_check
    CHECK (char_length(failure_reason) BETWEEN 1 AND 500)
);

ALTER TABLE public.external_link_alerts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.external_link_alerts
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.external_link_alerts TO service_role;

COMMENT ON TABLE public.external_link_alerts IS
  'Permanent one-row-per-link record that prevents repeat webmaster notifications.';

CREATE OR REPLACE FUNCTION carletonlodge_private.enqueue_external_link_failure_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notification_outbox (
    notification_type,
    recipient_email,
    payload,
    idempotency_key
  ) VALUES (
    'external_link_failure',
    'webmaster@carpmasons.ca',
    jsonb_build_object(
      'link_key', NEW.link_key,
      'link_name', NEW.link_name,
      'target_url', NEW.target_url,
      'failure_reason', NEW.failure_reason,
      'first_failed_at', NEW.first_failed_at
    ),
    'external-link-failure:' || NEW.link_key
  ) ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge_private.enqueue_external_link_failure_notification()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER enqueue_external_link_failure_notification
  AFTER INSERT ON public.external_link_alerts
  FOR EACH ROW EXECUTE FUNCTION carletonlodge_private.enqueue_external_link_failure_notification();
