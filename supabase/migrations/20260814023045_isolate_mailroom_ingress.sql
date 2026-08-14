/*
  # Isolate Lodge Mailroom ingress

  Communications readers may only receive rows addressed to the designated
  Lodge Mailroom. The Edge Function rejects other recipients before storage;
  this policy remains as defense in depth for provider or webhook regressions.
*/

DROP POLICY IF EXISTS "Communications readers can view inbound emails"
  ON public.inbound_emails;

CREATE POLICY "Communications readers can view inbound emails"
  ON public.inbound_emails FOR SELECT
  TO authenticated
  USING (
    public.has_admin_section_permission('communications', 'read')
    AND EXISTS (
      SELECT 1
      FROM unnest(
        COALESCE(to_addresses, '{}'::text[])
        || COALESCE(cc_addresses, '{}'::text[])
        || COALESCE(received_for_addresses, '{}'::text[])
      ) AS recipient(address)
      WHERE lower(btrim(recipient.address)) ~
        '(^|[<[:space:]])mailroom@(inbound[.])?carpmasons[.]ca([>[:space:]]|$)'
    )
  );

COMMENT ON POLICY "Communications readers can view inbound emails"
  ON public.inbound_emails IS
  'Restricts Communications readers to messages addressed to the Lodge Mailroom; service-role ingestion remains RLS-bypassing.';
