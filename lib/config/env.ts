import { z } from "zod";

const postgresUrl = z.string().trim().min(1).refine((value) => {
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol) && !!url.hostname;
  } catch {
    return false;
  }
}, "Use a PostgreSQL URL with a host.");

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

function optionalSetting<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (value) => typeof value === "string" ? value.trim() || undefined : value,
    schema.optional(),
  );
}

const databaseWithName = postgresUrl.refine(
  (value) => URL.canParse(value) && new URL(value).pathname.length > 1,
  "Include the database name in the PostgreSQL URL.",
);

const authUrl = z.url({ protocol: /^https?$/ }).refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return !url.username && !url.password;
}, "Use an HTTP or HTTPS application URL without embedded credentials.");

const settingsSchema = z.object({
  DATABASE_URL: optionalSetting(databaseWithName),
  DIRECT_URL: optionalSetting(databaseWithName),
  BLOB_READ_WRITE_TOKEN: optionalSetting(z.string()),
  BETTER_AUTH_URL: optionalSetting(authUrl),
  BETTER_AUTH_SECRET: optionalSetting(z.string().min(32, "Use an auth secret of at least 32 characters.")),
  GOOGLE_CLIENT_ID: optionalSetting(z.string()),
  GOOGLE_CLIENT_SECRET: optionalSetting(z.string()),
}).refine((settings) => Boolean(settings.GOOGLE_CLIENT_ID) === Boolean(settings.GOOGLE_CLIENT_SECRET), {
  path: ["GOOGLE_CLIENT_ID"],
  message: "Set both Google OAuth credentials or leave both blank.",
});

export function readEnvironment(environment: Record<string, string | undefined>) {
  const result = settingsSchema.safeParse(environment);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n"));
  }
  return result.data;
}
