import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { languageCookie, preferredLocale } from "@/lib/i18n";

export const getLocale = cache(async () => {
  const [jar, requestHeaders] = await Promise.all([cookies(), headers()]);
  return preferredLocale(jar.get(languageCookie)?.value, requestHeaders.get("accept-language"));
});
