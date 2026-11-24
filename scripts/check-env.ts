import nextEnvironment from "@next/env";
import { readEnvironment } from "../lib/config/env";

nextEnvironment.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

try {
  const settings = readEnvironment(process.env);
  for (const key of ["DATABASE_URL", "DIRECT_URL", "BLOB_READ_WRITE_TOKEN", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET"] as const) {
    console.log(`${key}: ${settings[key] ? "configured" : "not configured"}`);
  }
  console.log(`Google OAuth: ${settings.GOOGLE_CLIENT_ID ? "configured" : "not configured"}`);
  console.log("Environment format checks passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Environment validation failed.");
  process.exitCode = 1;
}
