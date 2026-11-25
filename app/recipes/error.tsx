"use client";

import { discoveryTranslator } from "@/lib/i18n/discovery";
import { useLocale } from "@/app/_components/language-provider";
import { Button, ButtonLink } from "@/app/_components/material";

export default function RecipeError({ retry }: { retry: () => void }) {
  const t = discoveryTranslator(useLocale());
  return (
    <main className="site-container py-10">
      <div className="site-panel space-y-4" role="alert">
        <h1 className="site-heading text-3xl">{t("Recipe couldn’t be loaded")}</h1>
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-11" onClick={retry}>{t("Try again")}</Button>
          <ButtonLink href="/recipes" variant="outline" className="min-h-11">{t("Explore recipes")}</ButtonLink>
        </div>
      </div>
    </main>
  );
}
