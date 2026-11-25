import { ButtonLink } from "@/app/_components/material";
import PageFrame from "@/app/_components/page-frame";

import { getLocale } from "@/lib/i18n/server";
import { makeTranslator } from "@/lib/i18n";
import { detailMessages } from "@/lib/i18n/recipe-detail";

export default async function RecipeNotFound() {
  const t = makeTranslator(await getLocale(), detailMessages);
  return (
    <PageFrame title={t("Recipe unavailable")}>
      <div className="site-panel space-y-3">
        <p>{t("This recipe may have been removed or may be private.")}</p>
        <ButtonLink href="/recipes" className="min-h-11">{t("Explore recipes")}</ButtonLink>
      </div>
    </PageFrame>
  );
}
