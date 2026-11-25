import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getIP } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { checkBotId } from "botid/server";
import { appName } from "@/lib/brand";
import { getDatabase } from "@/lib/db/client";
import { avatars } from "@/lib/product/avatar";
import { takeLimit } from "@/lib/security/rate-limit";
import {
  MAX_DISPLAY_NAME_LENGTH, MAX_EMAIL_LENGTH, MAX_EXISTING_PASSWORD_LENGTH,
  MAX_NEW_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH,
} from "./limits";

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
      ipAddress: { ipAddressHeaders: process.env.VERCEL === "1" ? ["x-vercel-forwarded-for"] : [] },
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
        const signup = ctx.path === "/sign-up/email";
        if (signup && ctx.request?.method === "POST" && process.env.VERCEL === "1") {
          const verdict = await checkBotId({ advancedOptions: { checkLevel: "basic" } }).catch(() => null);
          if (typeof verdict?.isBot !== "boolean")
            throw APIError.from("SERVICE_UNAVAILABLE", { code: "SIGNUP_CHECK_UNAVAILABLE", message: "Browser verification is temporarily unavailable. Please try again shortly." });
          if (verdict.isBot)
            throw APIError.from("FORBIDDEN", { code: "SIGNUP_BROWSER_REQUIRED", message: "We couldn’t verify your browser. Allow JavaScript, reload the page, and try again." });
        }
        if (ctx.request?.method === "POST" && ctx.path !== "/sign-out") {
          const identity = getIP(ctx.request, ctx.context.options) ?? "unknown";
          const policy = signup ? "signup" : ctx.path.startsWith("/sign-in/") ? "signin" : "authWrite";
          if (!await takeLimit(policy, identity)) {
            throw APIError.from("TOO_MANY_REQUESTS", { code: "AUTH_RATE_LIMIT", message: "Too many attempts. Please try again later." });
          }
        }
        const password = signup ? ctx.body?.password : ctx.body?.newPassword;
        if (typeof password === "string" && password.length > MAX_NEW_PASSWORD_LENGTH)
          throw APIError.from("BAD_REQUEST", { code: "PASSWORD_TOO_LONG", message: `Use up to ${MAX_NEW_PASSWORD_LENGTH} characters for your password.` });

        const email = signup ? ctx.body?.email : ctx.body?.newEmail;
        if (typeof email === "string" && email.length > MAX_EMAIL_LENGTH)
          throw APIError.from("BAD_REQUEST", { code: "INVALID_EMAIL", message: `Use an email address under ${MAX_EMAIL_LENGTH + 1} characters.` });

        if (!signup && ctx.path !== "/update-user") return;
        // Better Auth accepts image as a core field. Uploads must go through the avatar action.
        const image = ctx.body?.image;
        if (image != null && !avatars.some(avatar => avatar.image === image))
          throw APIError.from("BAD_REQUEST", { code: "AVATAR_UPLOAD_REQUIRED", message: "Upload your photo in Account under Avatar." });
        if (signup || ctx.body?.name !== undefined) {
          const name = typeof ctx.body?.name === "string" ? ctx.body.name.trim() : "";
          if (!name || name.length > MAX_DISPLAY_NAME_LENGTH)
            throw APIError.from("BAD_REQUEST", { code: "INVALID_DISPLAY_NAME", message: `Enter a display name of 1–${MAX_DISPLAY_NAME_LENGTH} characters.` });
          return { context: { body: { ...ctx.body, name } } };
        }
      }),
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      // Better Auth also applies this ceiling when verifying an existing credential.
      // The write hook above applies the shorter ceiling to new passwords.
      maxPasswordLength: MAX_EXISTING_PASSWORD_LENGTH,
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
