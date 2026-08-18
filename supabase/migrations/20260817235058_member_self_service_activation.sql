/*
  Track the website-membership activation lifecycle independently from Lodge
  mailbox provisioning. The activation timestamps are administrative metadata:
  members authenticate through Supabase Auth and never update these columns
  directly from the browser.
*/

ALTER TABLE public.lodge_members
  ADD COLUMN IF NOT EXISTS website_activation_invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS website_activation_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS website_activated_at timestamptz;

COMMENT ON COLUMN public.lodge_members.website_activation_invited_at IS
  'Most recent time an administrator sent the non-expiring membership activation instructions.';
COMMENT ON COLUMN public.lodge_members.website_activation_requested_at IS
  'Most recent time the member requested a one-time website access code.';
COMMENT ON COLUMN public.lodge_members.website_activated_at IS
  'First successful member verification through the website activation flow.';

-- Preserve the state of existing accounts. A linked account that has already
-- signed in is active; linked accounts without a successful sign-in remain in
-- the activation-started state.
UPDATE public.lodge_members AS member
SET
  website_activation_requested_at = COALESCE(
    member.website_activation_requested_at,
    account.created_at,
    member.updated_at,
    now()
  ),
  website_activated_at = COALESCE(
    member.website_activated_at,
    account.last_sign_in_at
  )
FROM auth.users AS account
WHERE member.linked_profile_id = account.id;

-- The table uses column-level grants for signed-in members. These lifecycle
-- fields are intentionally available only through the permission-checked
-- administrator RPC and the service-role activation functions.
REVOKE SELECT (
  website_activation_invited_at,
  website_activation_requested_at,
  website_activated_at
) ON public.lodge_members FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lodge_members TO service_role;
