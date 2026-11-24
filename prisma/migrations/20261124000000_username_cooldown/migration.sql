-- Existing users and accounts with a generated username can choose a handle immediately.
ALTER TABLE "users" ADD COLUMN "username_change_available_at" TIMESTAMPTZ(6);

CREATE FUNCTION enforce_username_cooldown() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  changed_at TIMESTAMPTZ := statement_timestamp();
BEGIN
  IF OLD.username_change_available_at > changed_at THEN
    RAISE EXCEPTION 'Username changes are limited to once a month'
      USING ERRCODE = '23514', CONSTRAINT = 'users_username_cooldown';
  END IF;
  -- UTC calendar arithmetic clamps month ends (for example, January 31 to February 28).
  NEW.username_change_available_at :=
    ((changed_at AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC';
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_username_cooldown
BEFORE UPDATE OF username ON "users"
FOR EACH ROW WHEN (OLD.username IS DISTINCT FROM NEW.username)
EXECUTE FUNCTION enforce_username_cooldown();
