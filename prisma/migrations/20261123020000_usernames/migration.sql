-- A separate identifier lets a user rename their profile without changing ownership.
-- PostgreSQL evaluates this volatile default independently for each existing and new row.
ALTER TABLE "users"
  ADD COLUMN "username" TEXT NOT NULL DEFAULT ('cook_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20)),
  ADD CONSTRAINT "users_username_format" CHECK ("username" COLLATE "C" ~ '^[a-z0-9_]{3,32}$'),
  ADD CONSTRAINT "users_username_unique" UNIQUE ("username");
