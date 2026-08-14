/*
  Keep the permanent deduplication record append-only to the Edge Function.
  Supabase default privileges grant service_role full access to new public
  tables, so explicitly narrow this table to the operations the checker needs.
*/

REVOKE ALL ON TABLE public.external_link_alerts FROM service_role;
GRANT SELECT, INSERT ON TABLE public.external_link_alerts TO service_role;
