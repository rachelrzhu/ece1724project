import { z } from "zod";

const optional = <T extends z.ZodType>(schema: T) => z.preprocess(
  (value) => typeof value === "string" ? value.trim() || undefined : value,
  schema.optional(),
);

const postgresUrl = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol) && Boolean(url.hostname) && url.pathname.length > 1;
  } catch {
    return false;
  }
}, "Use a PostgreSQL connection URL with a host and database name.");

const httpUrl = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Use an HTTP or HTTPS application URL without credentials.");

export const environmentSchema = z.object({
  DATABASE_URL: optional(postgresUrl),
  DIRECT_URL: optional(postgresUrl),
  BLOB_READ_WRITE_TOKEN: optional(z.string()),
  BETTER_AUTH_URL: optional(httpUrl),
  BETTER_AUTH_SECRET: optional(z.string().min(32, "Use an authentication secret of at least 32 characters.")),
  GOOGLE_CLIENT_ID: optional(z.string()),
  GOOGLE_CLIENT_SECRET: optional(z.string()),
}).superRefine((value, context) => {
  if (Boolean(value.GOOGLE_CLIENT_ID) !== Boolean(value.GOOGLE_CLIENT_SECRET)) {
    context.addIssue({ code: "custom", path: ["GOOGLE_CLIENT_ID"], message: "Set both Google OAuth credentials, or leave both blank until authentication is implemented." });
  }
});

export function readEnvironment(source: Record<string, string | undefined> = process.env) {
  const result = environmentSchema.safeParse(source);
  if (!result.success) {
    // Never interpolate input values or raw provider errors in diagnostic output.
    throw new Error(result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n"));
  }
  return result.data;
}
