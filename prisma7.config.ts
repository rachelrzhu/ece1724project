import nextEnv from "@next/env";
import { defineConfig } from "prisma/config";

// Prisma CLI and Next.js must resolve .env.local identically. Do not require
// credentials merely to generate/validate the client or build the placeholder.
nextEnv.loadEnvConfig(process.cwd());
const databaseUrl = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
