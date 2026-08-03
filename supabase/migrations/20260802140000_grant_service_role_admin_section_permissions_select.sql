/*
  # Grant service_role SELECT on admin_section_permissions

  The manage-member-login Edge Function reads carletonlodge.admin_section_permissions
  with its service-role client to summarize a member's delegated admin access in the
  account-invitation email. That table was only ever granted to `authenticated`
  (see 20260506130000_add_section_admin_permissions.sql), so every call from the
  service role failed with "permission denied for table admin_section_permissions"
  and the function returned a 500.

  This grants the minimum privilege the service role actually needs: read-only.
*/

GRANT SELECT ON carletonlodge.admin_section_permissions TO service_role;
