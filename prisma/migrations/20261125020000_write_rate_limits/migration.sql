CREATE TABLE write_rate_limits (
  policy varchar(24) NOT NULL,
  slot smallint NOT NULL CHECK (slot BETWEEN 0 AND 16383),
  used integer NOT NULL CHECK (used > 0),
  expires_at timestamptz(6) NOT NULL,
  PRIMARY KEY (policy, slot)
);

-- Count successful registrations, including first-time OAuth sign-ins, in the
-- same transaction as the account. Existing users can still sign in at capacity.
CREATE FUNCTION limit_new_accounts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO write_rate_limits AS bucket (policy, slot, used, expires_at)
  VALUES ('accounts', 0, 1, statement_timestamp() + interval '1 hour')
  ON CONFLICT (policy, slot) DO UPDATE SET
    used = CASE WHEN bucket.expires_at <= statement_timestamp() THEN 1 ELSE bucket.used + 1 END,
    expires_at = CASE WHEN bucket.expires_at <= statement_timestamp() THEN EXCLUDED.expires_at ELSE bucket.expires_at END
  WHERE bucket.expires_at <= statement_timestamp() OR bucket.used < 80;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hourly registration capacity reached' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DO $paths$
BEGIN
  EXECUTE format('ALTER FUNCTION %I.limit_new_accounts() SET search_path TO pg_catalog, %I, pg_temp',
                 current_schema(), current_schema());
END;
$paths$;
CREATE TRIGGER users_registration_capacity AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION limit_new_accounts();
