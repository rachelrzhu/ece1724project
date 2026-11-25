import type { Metadata } from "next";
import { SiteFooter } from "./_components/site-footer";
import { appName } from "@/lib/brand";
import { makeTranslator } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { siteMessages } from "@/lib/i18n/site";
import { LanguageProvider } from "./_components/language-provider";
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
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="flex flex-col">
        <LanguageProvider locale={locale}>
          {children}
          <SiteFooter locale={locale} />
        </LanguageProvider>
      </body>
    </html>
  );
}
