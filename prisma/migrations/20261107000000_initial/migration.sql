-- New empty databases only. Existing matching databases must be baselined,
-- not reset/recreated. See prisma/README.md.
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "files_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "files_size_positive" CHECK ("size" > 0)
);

CREATE UNIQUE INDEX "users_email_unique" ON "users"("email");
CREATE UNIQUE INDEX "files_pathname_unique" ON "files"("pathname");
CREATE INDEX "files_owner_id_idx" ON "files"("owner_id");

ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_users_id_fk"
FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
