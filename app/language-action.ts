"use server";

import { cookies } from "next/headers";
import { isLocale, languageCookie, type Locale } from "@/lib/i18n";

export async function setSiteLanguage(locale: Locale) {
  if (!isLocale(locale)) return;
  (await cookies()).set(languageCookie, locale, {
    path: "/", sameSite: "lax", httpOnly: true, secure: process.env.VERCEL === "1",
    maxAge: 60 * 60 * 24 * 365,
  });
}
