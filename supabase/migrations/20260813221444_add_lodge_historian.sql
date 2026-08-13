/*
  Add the Lodge Historian appointed office and its Lodge-owned role mailbox.

  Mailbox provisioning remains an explicit administrator action through the
  provider service; this migration only records the durable configuration.
*/

INSERT INTO public.lodge_positions (name, display_order)
SELECT 'Lodge Historian', 18
WHERE NOT EXISTS (
  SELECT 1
  FROM public.lodge_positions
  WHERE lower(name) = 'lodge historian'
);

INSERT INTO public.lodge_email_accounts (
  address,
  account_type,
  status,
  position_id,
  current_authorized_member_id,
  display_name,
  credential_status
)
SELECT
  'historian@carpmasons.ca',
  'OFFICER',
  'NOT_PROVISIONED',
  position.id,
  NULL,
  'Lodge Historian',
  'UNKNOWN'
FROM public.lodge_positions AS position
WHERE lower(position.name) = 'lodge historian'
  AND NOT EXISTS (
    SELECT 1
    FROM public.lodge_email_accounts AS account
    WHERE lower(account.address) = 'historian@carpmasons.ca'
       OR account.position_id = position.id
  );
