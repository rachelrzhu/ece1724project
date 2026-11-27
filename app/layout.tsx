import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SiteFooter } from "./_components/site-footer";
import { appName } from "@/lib/brand";
import { makeTranslator } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { siteMessages } from "@/lib/i18n/site";
import { LanguageProvider } from "./_components/language-provider";
import { ThemeProvider } from "./_components/theme-switch";
import { themeCookie } from "@/lib/theme";
import { displayUnitCookie, parseDisplayUnitSystem } from "@/lib/recipes/display-unit-preference";
import { DisplayUnitProvider } from "./_components/display-unit-provider";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = makeTranslator(await getLocale(), siteMessages);
  return {
    applicationName: appName,
    title: { default: `${appName} | ${t("Recipe sharing")}`, template: `%s | ${appName}` },
    description: t("Share recipes from your kitchen and adjust them for the people at your table."),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, jar] = await Promise.all([getLocale(), cookies()]);
  const preference = jar.get(themeCookie)?.value;
  const theme = preference === "light" || preference === "dark" ? preference : undefined;
  return (
    <html lang={locale} data-theme={theme}>
      <body className="flex flex-col">
        <ThemeProvider initialTheme={theme}>
          <LanguageProvider locale={locale}>
            <DisplayUnitProvider initialSystem={parseDisplayUnitSystem(jar.get(displayUnitCookie)?.value)}>
              {children}
            </DisplayUnitProvider>
            <SiteFooter />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
