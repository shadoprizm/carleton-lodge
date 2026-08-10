-- Cover Mailroom foreign keys used by audit and reviewer lookups.
CREATE INDEX IF NOT EXISTS trusted_email_senders_created_by_idx
  ON carletonlodge.trusted_email_senders(created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS mailroom_imports_reviewed_by_idx
  ON carletonlodge.mailroom_imports(reviewed_by)
  WHERE reviewed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS mailroom_imports_published_summons_idx
  ON carletonlodge.mailroom_imports(published_summons_id)
  WHERE published_summons_id IS NOT NULL;
