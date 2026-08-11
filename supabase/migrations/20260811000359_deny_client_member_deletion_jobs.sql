/* Make the server-only deletion retry table explicit to RLS auditors. */
CREATE POLICY "Member deletion jobs are server-only"
  ON public.member_deletion_jobs
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
