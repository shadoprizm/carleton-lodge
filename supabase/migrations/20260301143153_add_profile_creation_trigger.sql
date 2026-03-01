/*
  # Add automatic profile creation trigger

  ## Summary
  Creates a trigger that automatically inserts a row into the `profiles` table
  whenever a new user is created in `auth.users`. This prevents the issue where
  a user exists in auth but has no profile, which caused admin access to fail.

  ## Changes
  - New function: `handle_new_user()` - creates a profile on auth user creation
  - New trigger: `on_auth_user_created` - fires after insert on auth.users
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_admin, created_at)
  VALUES (NEW.id, NEW.email, false, now())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
