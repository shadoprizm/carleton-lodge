ALTER TABLE public.officer_mailbox_assignments
  ADD COLUMN IF NOT EXISTS activation_reminders_opted_out_at timestamptz;

CREATE TABLE public.role_mailbox_reminder_opt_out_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  assignment_id uuid NOT NULL REFERENCES public.officer_mailbox_assignments(id) ON DELETE CASCADE,
  notification_outbox_id uuid NOT NULL UNIQUE REFERENCES public.notification_outbox(id) ON DELETE CASCADE,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX role_mailbox_reminder_opt_out_tokens_assignment_idx
  ON public.role_mailbox_reminder_opt_out_tokens (assignment_id, created_at DESC);

ALTER TABLE public.role_mailbox_reminder_opt_out_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.role_mailbox_reminder_opt_out_tokens
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.role_mailbox_reminder_opt_out_tokens TO service_role;

CREATE OR REPLACE FUNCTION public.queue_role_mailbox_activation_reminder(
  p_assignment_id uuid,
  p_recipient_profile_id uuid,
  p_recipient_email text,
  p_payload jsonb,
  p_idempotency_key text,
  p_opt_out_token_hash text,
  p_max_attempts integer DEFAULT 3
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.officer_mailbox_assignments AS assignment
    WHERE assignment.id = p_assignment_id
      AND assignment.status = 'PENDING'
      AND assignment.activation_reminders_opted_out_at IS NULL
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notification_outbox (
    notification_type,
    recipient_profile_id,
    recipient_email,
    payload,
    idempotency_key,
    max_attempts
  )
  VALUES (
    'role_mailbox_invitation',
    p_recipient_profile_id,
    lower(p_recipient_email),
    p_payload,
    p_idempotency_key,
    p_max_attempts
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_job_id;

  IF v_job_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.role_mailbox_reminder_opt_out_tokens (
    token_hash,
    assignment_id,
    notification_outbox_id
  )
  VALUES (
    p_opt_out_token_hash,
    p_assignment_id,
    v_job_id
  );

  RETURN v_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_role_mailbox_activation_reminder(
  uuid, uuid, text, jsonb, text, text, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_role_mailbox_activation_reminder(
  uuid, uuid, text, jsonb, text, text, integer
) TO service_role;

COMMENT ON COLUMN public.officer_mailbox_assignments.activation_reminders_opted_out_at IS
  'When set, this assignment receives no further automated role-mailbox activation reminders.';
COMMENT ON TABLE public.role_mailbox_reminder_opt_out_tokens IS
  'Hashed, non-expiring confirmation tokens used only to stop automated activation reminders for a pending role-mailbox assignment.';
COMMENT ON FUNCTION public.queue_role_mailbox_activation_reminder(
  uuid, uuid, text, jsonb, text, text, integer
) IS
  'Atomically queues an eligible role-mailbox reminder and its hashed opt-out token. Service role only.';
