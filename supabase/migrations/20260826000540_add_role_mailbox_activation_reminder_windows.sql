/*
  Give officer and functional mailbox holders three complete 72-hour
  activation windows. The notification processor creates each successor token
  only after the preceding token expires, and stops after window three.
*/

ALTER TABLE public.email_account_action_tokens
  ADD COLUMN IF NOT EXISTS activation_window smallint NOT NULL DEFAULT 1;

ALTER TABLE public.email_account_action_tokens
  DROP CONSTRAINT IF EXISTS email_account_action_tokens_activation_window_check;

ALTER TABLE public.email_account_action_tokens
  ADD CONSTRAINT email_account_action_tokens_activation_window_check CHECK (
    activation_window BETWEEN 1 AND 3
  );

CREATE INDEX IF NOT EXISTS email_account_action_tokens_due_role_activation_idx
  ON public.email_account_action_tokens (expires_at)
  WHERE purpose = 'ROLE_ACTIVATION'
    AND activation_window < 3
    AND consumed_at IS NULL
    AND revoked_at IS NULL;

COMMENT ON COLUMN public.email_account_action_tokens.activation_window IS
  'One-based activation-link window. Role mailbox invitations stop after window 3; password-reset tokens remain window 1.';

-- The environment-scoped notification cron already invokes the processor.
-- Do not create or rewrite that job here: its URL and Vault credential are
-- deployment-specific.
