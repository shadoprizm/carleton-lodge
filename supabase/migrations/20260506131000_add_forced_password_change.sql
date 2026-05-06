/*
  # Forced password changes for admin-created member logins

  Adds a profile flag used when an admin assigns a temporary password. The app
  blocks normal use until the member changes that password after signing in.
*/

ALTER TABLE carletonlodge.profiles
  ADD COLUMN IF NOT EXISTS force_password_change boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_force_password_change_idx
  ON carletonlodge.profiles(force_password_change)
  WHERE force_password_change = true;
