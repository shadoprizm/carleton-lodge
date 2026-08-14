/*
  Supabase's existing default privileges granted authenticated users table-level
  write privileges when lodge_member_positions was created. RLS prevented those
  writes, but least privilege requires that roster changes remain available only
  through the permission-checked set_lodge_member_positions RPC.
*/

REVOKE ALL ON public.lodge_member_positions FROM authenticated;
GRANT SELECT ON public.lodge_member_positions TO authenticated;
