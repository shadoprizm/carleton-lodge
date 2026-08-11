/*
  Preserve Lodge email history without making roster offboarding impossible.

  Agreement receipts, completed officer assignments, and handover initiators
  retain immutable identity snapshots. Their live foreign-key links may then
  be cleared when the underlying member, mailbox, or Auth user is deleted.
  Pending and active officer assignments continue to prevent member deletion.
*/

ALTER TABLE public.email_agreement_acceptances
  ADD COLUMN member_name_snapshot text,
  ADD COLUMN email_address_snapshot text,
  ADD COLUMN accepted_by_email_snapshot text;

DROP TRIGGER protect_email_acceptance_history
  ON public.email_agreement_acceptances;

UPDATE public.email_agreement_acceptances AS acceptance
SET
  member_name_snapshot = member.full_name,
  email_address_snapshot = account.address,
  accepted_by_email_snapshot = COALESCE(actor.email, '[not recorded]')
FROM public.lodge_members AS member,
     public.lodge_email_accounts AS account,
     auth.users AS actor
WHERE member.id = acceptance.member_id
  AND account.id = acceptance.email_account_id
  AND actor.id = acceptance.accepted_by_profile_id;

ALTER TABLE public.email_agreement_acceptances
  ALTER COLUMN member_name_snapshot SET NOT NULL,
  ALTER COLUMN email_address_snapshot SET NOT NULL,
  ALTER COLUMN accepted_by_email_snapshot SET NOT NULL,
  ALTER COLUMN member_id DROP NOT NULL,
  ALTER COLUMN email_account_id DROP NOT NULL,
  ALTER COLUMN accepted_by_profile_id DROP NOT NULL,
  DROP CONSTRAINT email_agreement_acceptances_member_id_fkey,
  DROP CONSTRAINT email_agreement_acceptances_email_account_id_fkey,
  DROP CONSTRAINT email_agreement_acceptances_accepted_by_profile_id_fkey,
  ADD CONSTRAINT email_agreement_acceptances_member_id_fkey
    FOREIGN KEY (member_id) REFERENCES public.lodge_members(id)
    ON DELETE SET NULL,
  ADD CONSTRAINT email_agreement_acceptances_email_account_id_fkey
    FOREIGN KEY (email_account_id) REFERENCES public.lodge_email_accounts(id)
    ON DELETE SET NULL,
  ADD CONSTRAINT email_agreement_acceptances_accepted_by_profile_id_fkey
    FOREIGN KEY (accepted_by_profile_id) REFERENCES auth.users(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS email_agreement_acceptances_actor_idx
  ON public.email_agreement_acceptances (accepted_by_profile_id)
  WHERE accepted_by_profile_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.populate_email_acceptance_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF NEW.member_id IS NULL
    OR NEW.email_account_id IS NULL
    OR NEW.accepted_by_profile_id IS NULL THEN
    RAISE EXCEPTION 'New email agreement receipts require live member, mailbox, and profile links';
  END IF;

  SELECT
    member.full_name,
    account.address,
    COALESCE(actor.email, '[not recorded]')
  INTO
    NEW.member_name_snapshot,
    NEW.email_address_snapshot,
    NEW.accepted_by_email_snapshot
  FROM public.lodge_members AS member
  JOIN public.lodge_email_accounts AS account
    ON account.id = NEW.email_account_id
  JOIN auth.users AS actor
    ON actor.id = NEW.accepted_by_profile_id
  WHERE member.id = NEW.member_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Email agreement receipt links could not be resolved';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER populate_email_acceptance_snapshots
  BEFORE INSERT ON public.email_agreement_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.populate_email_acceptance_snapshots();

CREATE OR REPLACE FUNCTION public.protect_email_acceptance_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND (
      NEW.member_id IS NOT DISTINCT FROM OLD.member_id
      OR (OLD.member_id IS NOT NULL AND NEW.member_id IS NULL)
    )
    AND (
      NEW.email_account_id IS NOT DISTINCT FROM OLD.email_account_id
      OR (OLD.email_account_id IS NOT NULL AND NEW.email_account_id IS NULL)
    )
    AND (
      NEW.accepted_by_profile_id IS NOT DISTINCT FROM OLD.accepted_by_profile_id
      OR (
        OLD.accepted_by_profile_id IS NOT NULL
        AND NEW.accepted_by_profile_id IS NULL
      )
    )
    AND NEW.id IS NOT DISTINCT FROM OLD.id
    AND NEW.position_id IS NOT DISTINCT FROM OLD.position_id
    AND NEW.policy_version_id IS NOT DISTINCT FROM OLD.policy_version_id
    AND NEW.accepted_at IS NOT DISTINCT FROM OLD.accepted_at
    AND NEW.acknowledgement_state IS NOT DISTINCT FROM OLD.acknowledgement_state
    AND NEW.audit_metadata IS NOT DISTINCT FROM OLD.audit_metadata
    AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
    AND NEW.member_name_snapshot IS NOT DISTINCT FROM OLD.member_name_snapshot
    AND NEW.email_address_snapshot IS NOT DISTINCT FROM OLD.email_address_snapshot
    AND NEW.accepted_by_email_snapshot IS NOT DISTINCT FROM OLD.accepted_by_email_snapshot THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Email agreement acceptance receipts are immutable';
END;
$$;

CREATE TRIGGER protect_email_acceptance_history
  BEFORE UPDATE OR DELETE ON public.email_agreement_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.protect_email_acceptance_history();

ALTER TABLE public.officer_mailbox_assignments
  ADD COLUMN member_name_snapshot text,
  ADD COLUMN member_email_snapshot text;

UPDATE public.officer_mailbox_assignments AS assignment
SET
  member_name_snapshot = member.full_name,
  member_email_snapshot = COALESCE(
    member.email,
    member.lodge_email,
    '[not recorded]'
  )
FROM public.lodge_members AS member
WHERE member.id = assignment.member_id;

ALTER TABLE public.officer_mailbox_assignments
  ALTER COLUMN member_name_snapshot SET NOT NULL,
  ALTER COLUMN member_email_snapshot SET NOT NULL,
  ALTER COLUMN member_id DROP NOT NULL,
  DROP CONSTRAINT officer_mailbox_assignments_member_id_fkey,
  ADD CONSTRAINT officer_mailbox_assignments_member_id_fkey
    FOREIGN KEY (member_id) REFERENCES public.lodge_members(id)
    ON DELETE SET NULL,
  ADD CONSTRAINT officer_mailbox_assignments_current_member_required
    CHECK (
      member_id IS NOT NULL
      OR status IN ('ENDED', 'REVOKED', 'CANCELLED')
    );

CREATE OR REPLACE FUNCTION public.populate_officer_assignment_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.member_id IS NOT NULL THEN
    SELECT
      member.full_name,
      COALESCE(member.email, member.lodge_email, '[not recorded]')
    INTO NEW.member_name_snapshot, NEW.member_email_snapshot
    FROM public.lodge_members AS member
    WHERE member.id = NEW.member_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Officer mailbox assignment member could not be resolved';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER populate_officer_assignment_snapshots
  BEFORE INSERT OR UPDATE OF member_id
  ON public.officer_mailbox_assignments
  FOR EACH ROW EXECUTE FUNCTION public.populate_officer_assignment_snapshots();

ALTER TABLE public.officer_email_handovers
  ADD COLUMN initiated_by_email_snapshot text;

UPDATE public.officer_email_handovers AS handover
SET initiated_by_email_snapshot = COALESCE(actor.email, '[not recorded]')
FROM auth.users AS actor
WHERE actor.id = handover.initiated_by;

ALTER TABLE public.officer_email_handovers
  ALTER COLUMN initiated_by_email_snapshot SET NOT NULL,
  ALTER COLUMN initiated_by DROP NOT NULL,
  DROP CONSTRAINT officer_email_handovers_initiated_by_fkey,
  ADD CONSTRAINT officer_email_handovers_initiated_by_fkey
    FOREIGN KEY (initiated_by) REFERENCES auth.users(id)
    ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.populate_handover_initiator_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, auth
AS $$
BEGIN
  IF NEW.initiated_by IS NOT NULL THEN
    SELECT COALESCE(actor.email, '[not recorded]')
    INTO NEW.initiated_by_email_snapshot
    FROM auth.users AS actor
    WHERE actor.id = NEW.initiated_by;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Handover initiator could not be resolved';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER populate_handover_initiator_snapshot
  BEFORE INSERT OR UPDATE OF initiated_by
  ON public.officer_email_handovers
  FOR EACH ROW EXECUTE FUNCTION public.populate_handover_initiator_snapshot();

COMMENT ON COLUMN public.email_agreement_acceptances.member_name_snapshot IS
  'Immutable member name retained when live roster links are removed.';
COMMENT ON COLUMN public.email_agreement_acceptances.email_address_snapshot IS
  'Immutable Lodge mailbox address retained when the mailbox is removed.';
COMMENT ON COLUMN public.email_agreement_acceptances.accepted_by_email_snapshot IS
  'Immutable accepting-user email retained when the Auth user is removed.';
COMMENT ON COLUMN public.officer_mailbox_assignments.member_name_snapshot IS
  'Historical assignee name retained after completed assignments are unlinked.';
COMMENT ON COLUMN public.officer_mailbox_assignments.member_email_snapshot IS
  'Historical assignee email retained after completed assignments are unlinked.';
COMMENT ON COLUMN public.officer_email_handovers.initiated_by_email_snapshot IS
  'Historical initiator email retained if the Auth user is later removed.';
