import { ButtonLink } from "@/app/_components/material";
import PageFrame from "@/app/_components/page-frame";
import { makeTranslator } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { siteMessages } from "@/lib/i18n/site";

export default async function NotFound() {
  const t = makeTranslator(await getLocale(), siteMessages);
  return (
    <PageFrame title={t("Page unavailable")}>
      <ButtonLink href="/recipes">{t("Explore recipes")}</ButtonLink>
    </PageFrame>
  );
}
