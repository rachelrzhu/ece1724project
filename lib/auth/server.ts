import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { appName } from "@/lib/brand";
import { getDatabase } from "@/lib/db/client";
import { avatars } from "@/lib/product/avatar";

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
    user: {
      additionalFields: {
        // PostgreSQL assigns the initial username. Profile edits validate and save it.
        username: { type: "string", input: false, unique: true },
        usernameChangeAvailableAt: { type: "date", input: false, required: false },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email" && ctx.path !== "/update-user") return;
        // Better Auth accepts image as a core field. Uploads must go through the avatar action.
        const image = ctx.body?.image;
        if (image != null && !avatars.some(avatar => avatar.image === image))
          throw APIError.from("BAD_REQUEST", { code: "AVATAR_UPLOAD_REQUIRED", message: "Upload your photo in Account under Avatar." });
      }),
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
