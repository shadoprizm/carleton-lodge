/*
  Fix broken mailbox activation: email agreement acceptance snapshots

  populate_email_acceptance_snapshots() (added in
  20260811014602_allow_member_offboarding.sql) joins auth.users to snapshot
  the accepting profile's email. It was created without SECURITY DEFINER, so
  it runs with the privileges of whichever role performs the INSERT into
  email_agreement_acceptances - service_role from the manage-lodge-email and
  activate-member-mailbox Edge Functions. service_role has no SELECT grant on
  auth.users, so every such INSERT has failed with "permission denied for
  table users" since that migration shipped: no member or officer/functional
  ("positional") mailbox activation that requires agreement acceptance has
  been able to complete since 2026-08-11.

  The mailbox password change against MXroute happens before this insert, so
  affected members' passwords were already updated; only the local
  activation record (and the one-time token that guarded it) was left
  consumed with the account stuck below ACTIVE. Re-running
  admin_send_role_invitation (or the member-mailbox equivalent) issues a
  fresh token once this is deployed.

  Fix: mark the trigger function SECURITY DEFINER, matching the pattern
  already used by the other snapshot/knowledge-sync trigger functions in this
  schema, and pin its search_path accordingly.
*/

CREATE OR REPLACE FUNCTION public.populate_email_acceptance_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

REVOKE ALL ON FUNCTION public.populate_email_acceptance_snapshots()
  FROM PUBLIC, anon, authenticated;
