/*
  Carleton Lodge email identity and governance

  MXroute remains the mailbox provider. This migration adds the durable Lodge
  ownership, policy, assignment, handover, action-token, and audit records used
  by the application. Existing personal mailboxes are associated in place;
  nothing at MXroute is deleted or recreated by this migration.
*/

INSERT INTO carletonlodge.lodge_positions (name, display_order)
SELECT 'Webmaster', 17
WHERE NOT EXISTS (
  SELECT 1
  FROM carletonlodge.lodge_positions
  WHERE lower(name) = 'webmaster'
);

CREATE TABLE carletonlodge.lodge_email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('MEMBER', 'OFFICER', 'FUNCTIONAL')),
  status text NOT NULL DEFAULT 'NOT_PROVISIONED' CHECK (
    status IN (
      'NOT_PROVISIONED',
      'PROVISIONING',
      'INVITATION_PENDING',
      'TERMS_PENDING',
      'PASSWORD_SETUP_PENDING',
      'ACTIVE',
      'SUSPENDED',
      'DISABLED',
      'ERROR'
    )
  ),
  provider text NOT NULL DEFAULT 'mxroute' CHECK (provider = 'mxroute'),
  provider_mailbox_identifier text,
  associated_member_id uuid REFERENCES carletonlodge.lodge_members(id) ON DELETE RESTRICT,
  position_id uuid REFERENCES carletonlodge.lodge_positions(id) ON DELETE RESTRICT,
  current_authorized_member_id uuid REFERENCES carletonlodge.lodge_members(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  handover_behavior text NOT NULL DEFAULT 'ROTATE_CREDENTIALS' CHECK (
    handover_behavior IN ('ROTATE_CREDENTIALS')
  ),
  agreement_required boolean NOT NULL DEFAULT true,
  credential_status text NOT NULL DEFAULT 'UNKNOWN' CHECK (
    credential_status IN ('UNKNOWN', 'PROVISIONED_LOCKED', 'USER_SET', 'ROTATED', 'ERROR')
  ),
  provider_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  provisioned_at timestamptz,
  activated_at timestamptz,
  suspended_at timestamptz,
  disabled_at timestamptz,
  last_credential_rotation_at timestamptz,
  last_handover_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lodge_email_accounts_address_format CHECK (
    address ~ '^[a-z0-9][a-z0-9._-]*@carpmasons[.]ca$'
  ),
  CONSTRAINT lodge_email_accounts_ownership CHECK (
    (
      account_type = 'MEMBER'
      AND associated_member_id IS NOT NULL
      AND position_id IS NULL
      AND current_authorized_member_id IS NULL
    )
    OR
    (
      account_type IN ('OFFICER', 'FUNCTIONAL')
      AND associated_member_id IS NULL
      AND position_id IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX lodge_email_accounts_address_unique_idx
  ON carletonlodge.lodge_email_accounts (lower(address));
CREATE UNIQUE INDEX lodge_email_accounts_member_unique_idx
  ON carletonlodge.lodge_email_accounts (associated_member_id)
  WHERE account_type = 'MEMBER';
CREATE UNIQUE INDEX lodge_email_accounts_position_unique_idx
  ON carletonlodge.lodge_email_accounts (position_id)
  WHERE account_type IN ('OFFICER', 'FUNCTIONAL');
CREATE INDEX lodge_email_accounts_current_holder_idx
  ON carletonlodge.lodge_email_accounts (current_authorized_member_id)
  WHERE current_authorized_member_id IS NOT NULL;
CREATE INDEX lodge_email_accounts_status_idx
  ON carletonlodge.lodge_email_accounts (status);

CREATE TABLE carletonlodge.email_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_type text NOT NULL CHECK (
    policy_type IN ('MEMBER_EMAIL_TERMS', 'OFFICER_EMAIL_AGREEMENT')
  ),
  title text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  content text NOT NULL,
  acknowledgement text NOT NULL,
  effective_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  requires_reacceptance boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_policy_versions_type_version_unique UNIQUE (policy_type, version)
);

CREATE UNIQUE INDEX email_policy_versions_one_active_idx
  ON carletonlodge.email_policy_versions (policy_type)
  WHERE is_active;

CREATE TABLE carletonlodge.officer_email_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL REFERENCES carletonlodge.lodge_email_accounts(id) ON DELETE RESTRICT,
  position_id uuid NOT NULL REFERENCES carletonlodge.lodge_positions(id) ON DELETE RESTRICT,
  outgoing_member_id uuid REFERENCES carletonlodge.lodge_members(id) ON DELETE SET NULL,
  incoming_member_id uuid REFERENCES carletonlodge.lodge_members(id) ON DELETE SET NULL,
  initiated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  initiated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  state text NOT NULL DEFAULT 'PENDING_CONFIRMATION' CHECK (
    state IN (
      'PENDING_CONFIRMATION',
      'INITIATED',
      'REVOKING_ACCESS',
      'ROTATING_CREDENTIALS',
      'WAITING_FOR_ACCEPTANCE',
      'WAITING_FOR_PASSWORD',
      'ACTIVE',
      'FAILED',
      'CANCELLED'
    )
  ),
  outgoing_access_revoked_at timestamptz,
  credentials_rotated_at timestamptz,
  incoming_invited_at timestamptz,
  incoming_accepted_at timestamptz,
  incoming_activated_at timestamptz,
  completed_at timestamptz,
  failure_step text,
  failure_message text,
  reason text,
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT officer_email_handovers_different_members CHECK (
    outgoing_member_id IS NULL
    OR incoming_member_id IS NULL
    OR outgoing_member_id <> incoming_member_id
  )
);

CREATE UNIQUE INDEX officer_email_handovers_one_open_idx
  ON carletonlodge.officer_email_handovers (email_account_id)
  WHERE state NOT IN ('ACTIVE', 'CANCELLED');
CREATE INDEX officer_email_handovers_state_idx
  ON carletonlodge.officer_email_handovers (state, initiated_at DESC);

CREATE TABLE carletonlodge.officer_mailbox_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL REFERENCES carletonlodge.lodge_email_accounts(id) ON DELETE RESTRICT,
  position_id uuid NOT NULL REFERENCES carletonlodge.lodge_positions(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES carletonlodge.lodge_members(id) ON DELETE RESTRICT,
  assignment_start timestamptz NOT NULL DEFAULT now(),
  assignment_end timestamptz,
  status text NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'ACTIVE', 'ENDED', 'REVOKED', 'CANCELLED')
  ),
  handover_id uuid REFERENCES carletonlodge.officer_email_handovers(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT officer_mailbox_assignment_dates CHECK (
    assignment_end IS NULL OR assignment_end >= assignment_start
  )
);

CREATE UNIQUE INDEX officer_mailbox_assignments_one_current_idx
  ON carletonlodge.officer_mailbox_assignments (email_account_id)
  WHERE status IN ('PENDING', 'ACTIVE');
CREATE INDEX officer_mailbox_assignments_member_idx
  ON carletonlodge.officer_mailbox_assignments (member_id, status);
CREATE INDEX officer_mailbox_assignments_history_idx
  ON carletonlodge.officer_mailbox_assignments (email_account_id, assignment_start DESC);

CREATE TABLE carletonlodge.email_agreement_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES carletonlodge.lodge_members(id) ON DELETE RESTRICT,
  email_account_id uuid NOT NULL REFERENCES carletonlodge.lodge_email_accounts(id) ON DELETE RESTRICT,
  position_id uuid REFERENCES carletonlodge.lodge_positions(id) ON DELETE RESTRICT,
  policy_version_id uuid NOT NULL REFERENCES carletonlodge.email_policy_versions(id) ON DELETE RESTRICT,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  acknowledgement_state boolean NOT NULL CHECK (acknowledgement_state),
  accepted_by_profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  audit_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_agreement_acceptances_unique UNIQUE (
    member_id,
    email_account_id,
    policy_version_id
  )
);

CREATE INDEX email_agreement_acceptances_account_idx
  ON carletonlodge.email_agreement_acceptances (email_account_id, accepted_at DESC);
CREATE INDEX email_agreement_acceptances_member_idx
  ON carletonlodge.email_agreement_acceptances (member_id, accepted_at DESC);

CREATE TABLE carletonlodge.email_account_action_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  purpose text NOT NULL CHECK (
    purpose IN ('ROLE_ACTIVATION', 'PASSWORD_RESET')
  ),
  email_account_id uuid NOT NULL REFERENCES carletonlodge.lodge_email_accounts(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES carletonlodge.lodge_members(id) ON DELETE CASCADE,
  handover_id uuid REFERENCES carletonlodge.officer_email_handovers(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_account_action_tokens_expiry CHECK (expires_at > created_at)
);

CREATE INDEX email_account_action_tokens_lookup_idx
  ON carletonlodge.email_account_action_tokens (token_hash)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;
CREATE INDEX email_account_action_tokens_account_idx
  ON carletonlodge.email_account_action_tokens (email_account_id, purpose, created_at DESC);

CREATE TABLE carletonlodge.lodge_email_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  email_account_id uuid REFERENCES carletonlodge.lodge_email_accounts(id) ON DELETE SET NULL,
  member_id uuid REFERENCES carletonlodge.lodge_members(id) ON DELETE SET NULL,
  position_id uuid REFERENCES carletonlodge.lodge_positions(id) ON DELETE SET NULL,
  handover_id uuid REFERENCES carletonlodge.officer_email_handovers(id) ON DELETE SET NULL,
  actor_profile_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  outcome text NOT NULL DEFAULT 'SUCCESS' CHECK (outcome IN ('SUCCESS', 'FAILURE', 'WARNING')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lodge_email_audit_events_account_idx
  ON carletonlodge.lodge_email_audit_events (email_account_id, created_at DESC);
CREATE INDEX lodge_email_audit_events_member_idx
  ON carletonlodge.lodge_email_audit_events (member_id, created_at DESC);
CREATE INDEX lodge_email_audit_events_handover_idx
  ON carletonlodge.lodge_email_audit_events (handover_id, created_at DESC)
  WHERE handover_id IS NOT NULL;

CREATE TRIGGER update_lodge_email_accounts_updated_at
  BEFORE UPDATE ON carletonlodge.lodge_email_accounts
  FOR EACH ROW EXECUTE FUNCTION carletonlodge.update_updated_at_column();
CREATE TRIGGER update_officer_email_handovers_updated_at
  BEFORE UPDATE ON carletonlodge.officer_email_handovers
  FOR EACH ROW EXECUTE FUNCTION carletonlodge.update_updated_at_column();
CREATE TRIGGER update_officer_mailbox_assignments_updated_at
  BEFORE UPDATE ON carletonlodge.officer_mailbox_assignments
  FOR EACH ROW EXECUTE FUNCTION carletonlodge.update_updated_at_column();

CREATE OR REPLACE FUNCTION carletonlodge.enforce_officer_email_handover_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, carletonlodge
AS $$
BEGIN
  IF NEW.state = OLD.state THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.state = 'PENDING_CONFIRMATION' AND NEW.state IN ('INITIATED', 'CANCELLED'))
    OR (OLD.state = 'INITIATED' AND NEW.state IN ('REVOKING_ACCESS', 'FAILED', 'CANCELLED'))
    OR (OLD.state = 'REVOKING_ACCESS' AND NEW.state IN ('ROTATING_CREDENTIALS', 'FAILED'))
    OR (OLD.state = 'ROTATING_CREDENTIALS' AND NEW.state IN ('WAITING_FOR_ACCEPTANCE', 'FAILED'))
    OR (OLD.state = 'WAITING_FOR_ACCEPTANCE' AND NEW.state IN ('WAITING_FOR_PASSWORD', 'ACTIVE', 'FAILED', 'CANCELLED'))
    OR (OLD.state = 'WAITING_FOR_PASSWORD' AND NEW.state IN ('ACTIVE', 'FAILED', 'CANCELLED'))
    OR (OLD.state = 'FAILED' AND NEW.state IN ('ROTATING_CREDENTIALS', 'CANCELLED'))
  ) THEN
    RAISE EXCEPTION 'Invalid officer email handover transition: % -> %', OLD.state, NEW.state;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_officer_email_handover_transition
  BEFORE UPDATE OF state ON carletonlodge.officer_email_handovers
  FOR EACH ROW EXECUTE FUNCTION carletonlodge.enforce_officer_email_handover_transition();

CREATE OR REPLACE FUNCTION carletonlodge.protect_email_policy_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, carletonlodge
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Email policy versions cannot be deleted';
  END IF;

  IF NEW.policy_type IS DISTINCT FROM OLD.policy_type
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.content IS DISTINCT FROM OLD.content
    OR NEW.acknowledgement IS DISTINCT FROM OLD.acknowledgement
    OR NEW.effective_at IS DISTINCT FROM OLD.effective_at
    OR NEW.requires_reacceptance IS DISTINCT FROM OLD.requires_reacceptance
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Published email policy text and version history are immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_email_policy_history
  BEFORE UPDATE OR DELETE ON carletonlodge.email_policy_versions
  FOR EACH ROW EXECUTE FUNCTION carletonlodge.protect_email_policy_history();

CREATE OR REPLACE FUNCTION carletonlodge.protect_email_acceptance_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, carletonlodge
AS $$
BEGIN
  RAISE EXCEPTION 'Email agreement acceptance receipts are immutable';
END;
$$;

CREATE TRIGGER protect_email_acceptance_history
  BEFORE UPDATE OR DELETE ON carletonlodge.email_agreement_acceptances
  FOR EACH ROW EXECUTE FUNCTION carletonlodge.protect_email_acceptance_history();

CREATE OR REPLACE FUNCTION carletonlodge.create_email_policy_version_internal(
  target_policy_type text,
  target_title text,
  target_content text,
  target_acknowledgement text,
  target_effective_at timestamptz,
  target_requires_reacceptance boolean,
  target_created_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, carletonlodge
AS $$
DECLARE
  next_version integer;
  created_policy_id uuid;
BEGIN
  IF target_policy_type NOT IN ('MEMBER_EMAIL_TERMS', 'OFFICER_EMAIL_AGREEMENT') THEN
    RAISE EXCEPTION 'Unsupported email policy type';
  END IF;
  IF length(btrim(target_title)) < 5
    OR length(btrim(target_content)) < 100
    OR length(btrim(target_acknowledgement)) < 40 THEN
    RAISE EXCEPTION 'Policy title, content, or acknowledgement is incomplete';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(target_policy_type, 0));

  SELECT coalesce(max(version), 0) + 1
  INTO next_version
  FROM carletonlodge.email_policy_versions
  WHERE policy_type = target_policy_type;

  UPDATE carletonlodge.email_policy_versions
  SET is_active = false
  WHERE policy_type = target_policy_type
    AND is_active;

  INSERT INTO carletonlodge.email_policy_versions (
    policy_type,
    title,
    version,
    content,
    acknowledgement,
    effective_at,
    is_active,
    requires_reacceptance,
    created_by
  ) VALUES (
    target_policy_type,
    btrim(target_title),
    next_version,
    btrim(target_content),
    btrim(target_acknowledgement),
    target_effective_at,
    true,
    target_requires_reacceptance,
    target_created_by
  )
  RETURNING id INTO created_policy_id;

  RETURN created_policy_id;
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge.create_email_policy_version_internal(
  text, text, text, text, timestamptz, boolean, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION carletonlodge.create_email_policy_version_internal(
  text, text, text, text, timestamptz, boolean, uuid
) TO service_role;

INSERT INTO carletonlodge.email_policy_versions (
  policy_type,
  title,
  version,
  content,
  acknowledgement,
  effective_at,
  is_active,
  requires_reacceptance
) VALUES (
  'MEMBER_EMAIL_TERMS',
  'Carleton Lodge No. 465 Member Email Account Agreement',
  1,
  $member_policy$The `carpmasons.ca` domain is operated by Carleton Lodge No. 465 for its website, member services and Lodge-related communications.

The `carpmasons.ca` domain is not an official domain of Grand Lodge. Use of an email address on this domain does not imply that the domain is operated, administered or endorsed by Grand Lodge.

However, an email address ending in `@carpmasons.ca` has a clear and identifiable association with Carleton Lodge No. 465.

Members should understand that when they communicate using their `@carpmasons.ca` email address, recipients may reasonably associate that communication with their connection to Carleton Lodge.

Members are therefore expected to conduct themselves appropriately, responsibly and professionally when using a Lodge-provided email address.

By activating and using my `@carpmasons.ca` email account, I acknowledge and agree that:

• My account is provided by Carleton Lodge No. 465 as part of its member services.
• `carpmasons.ca` is not an official Grand Lodge domain.
• My email address visibly associates me with Carleton Lodge No. 465.
• I will conduct myself appropriately, responsibly and professionally when using the account.
• I understand that communications sent from this address may reflect upon Carleton Lodge.
• I will not use the account in a manner that could reasonably bring Carleton Lodge No. 465 or Freemasonry into disrepute.
• I will not use the account for unlawful, fraudulent, deceptive, abusive, threatening, harassing or otherwise inappropriate activity.
• I will not use the account for spam or unrelated unsolicited commercial communication.
• I will not represent a personal opinion as an official position of Carleton Lodge No. 465 or Grand Lodge.
• Possession of a `@carpmasons.ca` address does not give me authority to speak officially on behalf of Carleton Lodge, Grand Lodge or Freemasonry generally.
• I will protect my account credentials and will not knowingly share my password.
• I will promptly report suspected compromise or unauthorized access.
• I understand that Carleton Lodge retains administrative control over accounts operating on its domain.
• I understand that authorized Lodge administrators may administer or access the account where reasonably necessary for security, technical support, continuity, investigation of misuse, records management or legitimate Lodge administration.
• I understand that the account may be suspended or disabled when reasonably required for security, misuse, loss of membership eligibility, technical administration or other legitimate Lodge purposes.
• I understand that the account is Lodge-provided and is not intended to replace my private personal email account.$member_policy$,
  'I have read and understand the Carleton Lodge No. 465 Member Email Account Agreement. I understand that use of my `@carpmasons.ca` email address creates a visible association between my communications and Carleton Lodge No. 465, and I agree to use the account responsibly, appropriately and professionally.',
  now(),
  true,
  true
), (
  'OFFICER_EMAIL_AGREEMENT',
  'Carleton Lodge No. 465 Officer and Functional Email Account Agreement',
  1,
  $officer_policy$The `carpmasons.ca` domain is operated by Carleton Lodge No. 465 for its website, member services and Lodge communications.

The domain is not an official Grand Lodge domain and use of an email address on the domain does not imply that Grand Lodge operates, administers or endorses it.

The officer or functional email account being assigned to me belongs to Carleton Lodge No. 465.

I am receiving temporary access because I currently hold, or have been assigned responsibility for, the associated Lodge office or function.

I acknowledge and agree that:

• The email address and mailbox belong to Carleton Lodge No. 465.
• Access is provided because of my current Lodge office or function.
• The mailbox is not my personal mailbox.
• The mailbox is intended for Lodge-related business.
• My access is temporary and may end when I cease to hold the associated office or responsibility.
• The mailbox will be transferred to my successor or another authorized individual when appropriate.
• Sent and received messages remain part of the Lodge mailbox.
• Existing folders, attachments, contacts and correspondence may remain available to future authorized account holders.
• I will not use the mailbox for private personal correspondence that I would not reasonably expect a successor or authorized Lodge administrator to access.
• Carleton Lodge retains administrative control of the mailbox.
• Authorized Lodge administrators may access or administer the account where reasonably necessary for security, continuity, technical support, records management, investigation of misuse or legitimate Lodge administration.
• When my assignment ends, my credentials may be revoked without deleting the mailbox or its records.
• I must protect my credentials and will not knowingly share my password.
• I will promptly report suspected compromise or unauthorized access.
• I will use the account responsibly and professionally.
• I understand that use of a `@carpmasons.ca` address visibly associates my communications with Carleton Lodge No. 465.
• I will not use the account in a manner that could reasonably bring Carleton Lodge No. 465 or Freemasonry into disrepute.
• I will not use the account for unlawful, fraudulent, deceptive, abusive, threatening, harassing or inappropriate activity.
• I will not present personal opinions as authorized Lodge or Grand Lodge positions.
• Access to the mailbox does not give me authority to speak on behalf of Grand Lodge.
• Lodge correspondence and records should remain in the role mailbox where appropriate so continuity is preserved.$officer_policy$,
  'I have read and understand the Carleton Lodge No. 465 Officer and Functional Email Account Agreement. I understand that this mailbox belongs to the Lodge, that my access is temporary, and that the mailbox and its correspondence will be transferred to my successor or another authorized account holder when my assignment ends.',
  now(),
  true,
  true
);

-- Associate existing personal mailboxes without changing anything at MXroute.
INSERT INTO carletonlodge.lodge_email_accounts (
  address,
  account_type,
  status,
  provider_mailbox_identifier,
  associated_member_id,
  display_name,
  credential_status,
  provisioned_at,
  activated_at,
  suspended_at
)
SELECT
  lower(member.lodge_email),
  'MEMBER',
  CASE member.mailbox_status
    WHEN 'active' THEN 'TERMS_PENDING'
    WHEN 'pending_activation' THEN 'TERMS_PENDING'
    WHEN 'provisioning' THEN 'PROVISIONING'
    WHEN 'suspended' THEN 'SUSPENDED'
    WHEN 'error' THEN 'ERROR'
    ELSE 'NOT_PROVISIONED'
  END,
  lower(member.lodge_email),
  member.id,
  member.full_name,
  CASE member.mailbox_status
    WHEN 'active' THEN 'USER_SET'
    WHEN 'pending_activation' THEN 'PROVISIONED_LOCKED'
    ELSE 'UNKNOWN'
  END,
  member.mailbox_provisioned_at,
  member.mailbox_activated_at,
  CASE WHEN member.mailbox_status = 'suspended' THEN now() END
FROM carletonlodge.lodge_members AS member
WHERE member.lodge_email IS NOT NULL
ON CONFLICT DO NOTHING;

-- Configure the initial role addresses. Provisioning is performed through the
-- provider service so migration execution never risks mailbox contents.
WITH role_configuration(position_name, address, account_type, display_name) AS (
  VALUES
    ('Worshipful Master', 'worshipfulmaster@carpmasons.ca', 'OFFICER', 'Worshipful Master'),
    ('Senior Warden', 'seniorwarden@carpmasons.ca', 'OFFICER', 'Senior Warden'),
    ('Junior Warden', 'juniorwarden@carpmasons.ca', 'OFFICER', 'Junior Warden'),
    ('Secretary', 'secretary@carpmasons.ca', 'OFFICER', 'Secretary'),
    ('Treasurer', 'treasurer@carpmasons.ca', 'OFFICER', 'Treasurer'),
    ('Webmaster', 'webmaster@carpmasons.ca', 'FUNCTIONAL', 'Webmaster')
)
INSERT INTO carletonlodge.lodge_email_accounts (
  address,
  account_type,
  status,
  position_id,
  current_authorized_member_id,
  display_name,
  credential_status
)
SELECT
  configuration.address,
  configuration.account_type,
  'NOT_PROVISIONED',
  position.id,
  CASE
    WHEN configuration.position_name = 'Webmaster' THEN (
      SELECT member.id
      FROM carletonlodge.lodge_members AS member
      WHERE lower(member.full_name) LIKE '%jeramy%ratelle%'
      ORDER BY member.created_at
      LIMIT 1
    )
    ELSE NULL
  END,
  configuration.display_name,
  'UNKNOWN'
FROM role_configuration AS configuration
JOIN carletonlodge.lodge_positions AS position
  ON lower(position.name) = lower(configuration.position_name)
ON CONFLICT DO NOTHING;

INSERT INTO carletonlodge.officer_mailbox_assignments (
  email_account_id,
  position_id,
  member_id,
  status,
  reason
)
SELECT
  account.id,
  account.position_id,
  account.current_authorized_member_id,
  'PENDING',
  'Initial Lodge role mailbox configuration'
FROM carletonlodge.lodge_email_accounts AS account
WHERE account.account_type IN ('OFFICER', 'FUNCTIONAL')
  AND account.current_authorized_member_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION carletonlodge.current_lodge_member_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, carletonlodge
AS $$
  SELECT member.id
  FROM carletonlodge.lodge_members AS member
  WHERE member.linked_profile_id = (SELECT auth.uid())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION carletonlodge.current_lodge_member_id()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION carletonlodge.current_lodge_member_id()
  TO authenticated;

CREATE OR REPLACE FUNCTION carletonlodge.get_my_lodge_email_accounts()
RETURNS TABLE (
  id uuid,
  address text,
  account_type text,
  status text,
  display_name text,
  position_id uuid,
  position_name text,
  credential_status text,
  provisioned_at timestamptz,
  activated_at timestamptz,
  last_credential_rotation_at timestamptz,
  last_handover_at timestamptz,
  policy_version_id uuid,
  policy_title text,
  policy_version integer,
  policy_content text,
  policy_acknowledgement text,
  policy_effective_at timestamptz,
  agreement_accepted_at timestamptz,
  needs_agreement boolean,
  needs_password_setup boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, carletonlodge
AS $$
  WITH current_member AS (
    SELECT carletonlodge.current_lodge_member_id() AS id
  )
  SELECT
    account.id,
    account.address,
    account.account_type,
    account.status,
    account.display_name,
    account.position_id,
    position.name,
    account.credential_status,
    account.provisioned_at,
    account.activated_at,
    account.last_credential_rotation_at,
    account.last_handover_at,
    policy.id,
    policy.title,
    policy.version,
    policy.content,
    policy.acknowledgement,
    policy.effective_at,
    acceptance.accepted_at,
    account.agreement_required AND acceptance.id IS NULL,
    account.credential_status IN ('UNKNOWN', 'PROVISIONED_LOCKED', 'ROTATED', 'ERROR')
      AND account.status <> 'NOT_PROVISIONED'
  FROM carletonlodge.lodge_email_accounts AS account
  CROSS JOIN current_member
  LEFT JOIN carletonlodge.lodge_positions AS position
    ON position.id = account.position_id
  LEFT JOIN LATERAL (
    SELECT version.*
    FROM carletonlodge.email_policy_versions AS version
    WHERE version.policy_type = CASE
      WHEN account.account_type = 'MEMBER' THEN 'MEMBER_EMAIL_TERMS'
      ELSE 'OFFICER_EMAIL_AGREEMENT'
    END
      AND version.is_active
      AND version.effective_at <= now()
    ORDER BY version.version DESC
    LIMIT 1
  ) AS policy ON true
  LEFT JOIN LATERAL (
    SELECT receipt.id, receipt.accepted_at
    FROM carletonlodge.email_agreement_acceptances AS receipt
    JOIN carletonlodge.email_policy_versions AS accepted_policy
      ON accepted_policy.id = receipt.policy_version_id
    WHERE receipt.member_id = current_member.id
      AND receipt.email_account_id = account.id
      AND (
        receipt.policy_version_id = policy.id
        OR (
          NOT policy.requires_reacceptance
          AND accepted_policy.policy_type = policy.policy_type
        )
      )
    ORDER BY receipt.accepted_at DESC
    LIMIT 1
  ) AS acceptance ON true
  WHERE current_member.id IS NOT NULL
    AND account.enabled
    AND (
      (account.account_type = 'MEMBER' AND account.associated_member_id = current_member.id)
      OR
      (
        account.account_type IN ('OFFICER', 'FUNCTIONAL')
        AND EXISTS (
          SELECT 1
          FROM carletonlodge.officer_mailbox_assignments AS assignment
          WHERE assignment.email_account_id = account.id
            AND assignment.member_id = current_member.id
            AND assignment.status IN ('PENDING', 'ACTIVE')
        )
      )
    )
  ORDER BY CASE WHEN account.account_type = 'MEMBER' THEN 0 ELSE 1 END,
    position.display_order NULLS LAST,
    account.address;
$$;

REVOKE ALL ON FUNCTION carletonlodge.get_my_lodge_email_accounts()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION carletonlodge.get_my_lodge_email_accounts()
  TO authenticated;

CREATE OR REPLACE FUNCTION carletonlodge.get_email_agreement_receipt(target_account_id uuid)
RETURNS TABLE (
  acceptance_id uuid,
  member_name text,
  email_address text,
  position_name text,
  agreement_title text,
  agreement_version integer,
  effective_at timestamptz,
  accepted_at timestamptz,
  acknowledgement text,
  policy_content text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, carletonlodge
AS $$
DECLARE
  current_member uuid := carletonlodge.current_lodge_member_id();
BEGIN
  IF current_member IS NULL
    AND NOT carletonlodge.has_admin_section_permission('members', 'read') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  IF NOT carletonlodge.has_admin_section_permission('members', 'read')
    AND NOT EXISTS (
      SELECT 1
      FROM carletonlodge.email_agreement_acceptances AS own_receipt
      WHERE own_receipt.email_account_id = target_account_id
        AND own_receipt.member_id = current_member
    ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    acceptance.id,
    member.full_name,
    account.address,
    position.name,
    policy.title,
    policy.version,
    policy.effective_at,
    acceptance.accepted_at,
    policy.acknowledgement,
    policy.content
  FROM carletonlodge.email_agreement_acceptances AS acceptance
  JOIN carletonlodge.lodge_members AS member ON member.id = acceptance.member_id
  JOIN carletonlodge.lodge_email_accounts AS account ON account.id = acceptance.email_account_id
  JOIN carletonlodge.email_policy_versions AS policy ON policy.id = acceptance.policy_version_id
  LEFT JOIN carletonlodge.lodge_positions AS position ON position.id = acceptance.position_id
  WHERE acceptance.email_account_id = target_account_id
    AND (
      carletonlodge.has_admin_section_permission('members', 'read')
      OR acceptance.member_id = current_member
    )
  ORDER BY acceptance.accepted_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION carletonlodge.get_email_agreement_receipt(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION carletonlodge.get_email_agreement_receipt(uuid)
  TO authenticated;

ALTER TABLE carletonlodge.lodge_email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE carletonlodge.email_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE carletonlodge.officer_email_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE carletonlodge.officer_mailbox_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE carletonlodge.email_agreement_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE carletonlodge.email_account_action_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE carletonlodge.lodge_email_audit_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON carletonlodge.lodge_email_accounts TO authenticated;
GRANT SELECT ON carletonlodge.email_policy_versions TO authenticated;
GRANT SELECT ON carletonlodge.officer_email_handovers TO authenticated;
GRANT SELECT ON carletonlodge.officer_mailbox_assignments TO authenticated;
GRANT SELECT ON carletonlodge.email_agreement_acceptances TO authenticated;
GRANT SELECT ON carletonlodge.lodge_email_audit_events TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON carletonlodge.lodge_email_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON carletonlodge.email_policy_versions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON carletonlodge.officer_email_handovers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON carletonlodge.officer_mailbox_assignments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON carletonlodge.email_agreement_acceptances TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON carletonlodge.email_account_action_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON carletonlodge.lodge_email_audit_events TO service_role;

CREATE POLICY "Members can view their Lodge email accounts"
  ON carletonlodge.lodge_email_accounts FOR SELECT
  TO authenticated
  USING (
    carletonlodge.has_admin_section_permission('members', 'read')
    OR associated_member_id = carletonlodge.current_lodge_member_id()
    OR EXISTS (
      SELECT 1
      FROM carletonlodge.officer_mailbox_assignments AS assignment
      WHERE assignment.email_account_id = lodge_email_accounts.id
        AND assignment.member_id = carletonlodge.current_lodge_member_id()
        AND assignment.status IN ('PENDING', 'ACTIVE')
    )
  );

CREATE POLICY "Members can view published email policies"
  ON carletonlodge.email_policy_versions FOR SELECT
  TO authenticated
  USING (is_active OR carletonlodge.has_admin_section_permission('members', 'read'));

CREATE POLICY "Participants can view mailbox assignments"
  ON carletonlodge.officer_mailbox_assignments FOR SELECT
  TO authenticated
  USING (
    carletonlodge.has_admin_section_permission('members', 'read')
    OR member_id = carletonlodge.current_lodge_member_id()
  );

CREATE POLICY "Participants can view officer email handovers"
  ON carletonlodge.officer_email_handovers FOR SELECT
  TO authenticated
  USING (
    carletonlodge.has_admin_section_permission('members', 'read')
    OR outgoing_member_id = carletonlodge.current_lodge_member_id()
    OR incoming_member_id = carletonlodge.current_lodge_member_id()
  );

CREATE POLICY "Members can view their agreement receipts"
  ON carletonlodge.email_agreement_acceptances FOR SELECT
  TO authenticated
  USING (
    carletonlodge.has_admin_section_permission('members', 'read')
    OR member_id = carletonlodge.current_lodge_member_id()
  );

CREATE POLICY "Members can view their email audit history"
  ON carletonlodge.lodge_email_audit_events FOR SELECT
  TO authenticated
  USING (
    carletonlodge.has_admin_section_permission('members', 'read')
    OR member_id = carletonlodge.current_lodge_member_id()
  );

REVOKE ALL ON carletonlodge.email_account_action_tokens
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE carletonlodge.lodge_email_accounts IS
  'Canonical Lodge governance record for personal and Lodge-owned MXroute mailboxes. No passwords are stored.';
COMMENT ON TABLE carletonlodge.email_account_action_tokens IS
  'Stores only SHA-256 hashes of time-limited single-use mailbox activation/reset tokens.';
COMMENT ON TABLE carletonlodge.officer_email_handovers IS
  'Recoverable state machine for preserving a role mailbox while changing its authorized member.';
COMMENT ON COLUMN carletonlodge.lodge_email_accounts.provider_status IS
  'Non-sensitive provider state such as quota, usage, daily send count, and provider suspension flag.';
