import nextEnv from "@next/env";
import { readEnvironment } from "../lib/env";

nextEnv.loadEnvConfig(process.cwd());

try {
  const env = readEnvironment();
  for (const key of ["DATABASE_URL", "DIRECT_URL", "BLOB_READ_WRITE_TOKEN", "BETTER_AUTH_SECRET"] as const) {
    console.log(`${key}: ${env[key] ? "configured" : "not configured"}`);
  }
  console.log(`Google OAuth: ${env.GOOGLE_CLIENT_ID ? "credentials configured; integration pending" : "not configured; integration pending"}`);
  console.log("Environment format: valid. This does not test cloud connectivity or enable authentication.");
  if (!env.DATABASE_URL || !env.BLOB_READ_WRITE_TOKEN) {
    console.log("Frontend-only mode is available. Add development database/Blob credentials before using cloud features.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Environment validation failed.");
  process.exitCode = 1;
}
