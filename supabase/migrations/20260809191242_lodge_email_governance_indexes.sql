-- Explicitly deny browser clients access to hashed action tokens. Service-role
-- Edge Functions bypass RLS and remain the only token-management path.
CREATE POLICY "No client access to Lodge email action tokens"
  ON public.email_account_action_tokens
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Cover governance foreign keys used by lifecycle cleanup and history views.
CREATE INDEX IF NOT EXISTS email_action_tokens_member_idx
  ON public.email_account_action_tokens (member_id);
CREATE INDEX IF NOT EXISTS email_action_tokens_handover_idx
  ON public.email_account_action_tokens (handover_id)
  WHERE handover_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_policy_versions_creator_idx
  ON public.email_policy_versions (created_by)
  WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS lodge_email_audit_events_position_idx
  ON public.lodge_email_audit_events (position_id)
  WHERE position_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS lodge_email_audit_events_actor_idx
  ON public.lodge_email_audit_events (actor_profile_id)
  WHERE actor_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS officer_email_handovers_position_idx
  ON public.officer_email_handovers (position_id);
CREATE INDEX IF NOT EXISTS officer_email_handovers_outgoing_member_idx
  ON public.officer_email_handovers (outgoing_member_id)
  WHERE outgoing_member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS officer_email_handovers_incoming_member_idx
  ON public.officer_email_handovers (incoming_member_id)
  WHERE incoming_member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS officer_email_handovers_initiator_idx
  ON public.officer_email_handovers (initiated_by);
CREATE INDEX IF NOT EXISTS officer_mailbox_assignments_position_idx
  ON public.officer_mailbox_assignments (position_id);
CREATE INDEX IF NOT EXISTS officer_mailbox_assignments_handover_idx
  ON public.officer_mailbox_assignments (handover_id)
  WHERE handover_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS officer_mailbox_assignments_assigner_idx
  ON public.officer_mailbox_assignments (assigned_by)
  WHERE assigned_by IS NOT NULL;
