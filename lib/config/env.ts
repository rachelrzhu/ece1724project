import { z } from "zod";

const postgresUrl = z.string().trim().min(1).refine((value) => {
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol) && !!url.hostname;
  } catch {
    return false;
  }
});

const databaseSchema = z.object({ DATABASE_URL: postgresUrl });

export function readDatabaseEnvironment(environment: Record<string, string | undefined>) {
  const result = databaseSchema.safeParse(environment);
  if (!result.success) {
    // Never include Zod issues or connection strings in configuration errors.
    throw new Error("Set DATABASE_URL to a valid PostgreSQL connection URL in .env.local.");
  }
  return result.data;
}

export function readBlobEnvironment(environment: Record<string, string | undefined>) {
  const token = environment.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new Error("Set BLOB_READ_WRITE_TOKEN in .env.local to use private image storage.");
  return { BLOB_READ_WRITE_TOKEN: token };
}
