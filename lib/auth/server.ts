import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { appName } from "@/lib/brand";
import { getDatabase } from "@/lib/db/client";

export function getGoogleProviderOptions() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (clientId && clientSecret) return { clientId, clientSecret };
}

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Configure BETTER_AUTH_SECRET (at least 32 characters).");
  return betterAuth({
    appName,
    baseURL: process.env.BETTER_AUTH_URL,
    secret,
    database: prismaAdapter(getDatabase(), {
      provider: "postgresql",
      transaction: true,
    }),
    advanced: {
      database: { generateId: () => crypto.randomUUID() },
      // Retain the session cookie namespace across display-name changes.
      cookiePrefix: "savor",
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    socialProviders: { google: getGoogleProviderOptions() },
    onAPIError: { errorURL: "/account" },
    session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
      },
    },
    plugins: [nextCookies()],
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (instance ??= createAuth());
}
export const readSession = cache(async () => {
  const requestHeaders = await headers();
  if (!requestHeaders.get("cookie")?.includes("savor.session_token"))
    return null;
  return getAuth().api.getSession({ headers: requestHeaders });
});
export { safeReturnPath } from "./return-path";
