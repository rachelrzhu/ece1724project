CREATE FUNCTION assign_signup_username() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  base text;
  candidate text;
  suffix text;
  digits integer := 4;
BEGIN
  IF TG_OP = 'UPDATE' OR NEW.username IS DISTINCT FROM '' THEN
    -- An explicit insert or rename can claim the same candidate as a generated name.
    PERFORM pg_advisory_xact_lock(hashtextextended('users.username:' || NEW.username, 0));
    RETURN NEW;
  END IF;

  base := lower(normalize(coalesce(NEW.name, ''), NFKC) COLLATE pg_catalog.pg_c_utf8);
  base := regexp_replace(base COLLATE pg_catalog.pg_c_utf8, '^[^[:alpha:]0-9_]+|[^[:alpha:]0-9_]+$', '', 'g');
  base := regexp_replace(base COLLATE pg_catalog.pg_c_utf8, '[^[:alpha:]0-9_]+', '_', 'g');
  base := left(coalesce(nullif(base, ''), 'cook'), 32);
  candidate := base;
  LOOP
    -- Claim a candidate until commit. A concurrent signup can immediately try a suffix.
    IF pg_try_advisory_xact_lock(hashtextextended('users.username:' || candidate, 0)) THEN
      IF NOT EXISTS (SELECT 1 FROM users WHERE username = candidate) THEN
        NEW.username := candidate;
        RETURN NEW;
      END IF;
    END IF;
    suffix := lpad(floor(random() * power(10, digits))::bigint::text, digits, '0');
    candidate := left(base, 32 - digits) || suffix;
    digits := least(digits + 1, 9);
  END LOOP;
END;
$$;

CREATE TRIGGER users_assign_username
BEFORE INSERT OR UPDATE OF username ON users
FOR EACH ROW EXECUTE FUNCTION assign_signup_username();

-- The insert trigger replaces the empty default before constraints are checked.
ALTER TABLE users
  ALTER COLUMN username SET DEFAULT '',
  DROP CONSTRAINT users_username_format,
  ADD CONSTRAINT users_username_format CHECK (
    username COLLATE pg_catalog.pg_c_utf8 ~ '^[[:alpha:]0-9_]{1,32}$'
    AND username = lower(username COLLATE pg_catalog.pg_c_utf8)
  );
