import type { Metadata } from "next";
import { makeTranslator, type Locale, type Messages } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { detailMessages } from "@/lib/i18n/recipe-detail";
import { difficultyLabels, difficultyMessages } from "@/lib/i18n/recipe-labels";
import { RecipeTranslation, RecipeText, RecipeTranslationControls } from "@/app/_components/recipe-translation";
import { ButtonLink } from "@/app/_components/material";
import { notFound } from "next/navigation";
import PageFrame from "@/app/_components/page-frame";
import { CookByline } from "@/app/_components/cook-byline";
import { RecipeCover } from "@/app/_components/recipe-cover";
import { RecipeReactions } from "@/app/_components/recipe-reactions";
import { getRecipe, type RecipeDetailData } from "@/lib/product/queries";
import RecipeActions from "../_components/recipe-actions";
import { formatScaledQuantity } from "@/lib/recipes/measurements";
import { getUnitOptions } from "@/lib/recipes/unit-options";
import RecipeEditor from "../_components/recipe-editor";
import ScalingWorkspace from "../_components/scaling-workspace";

export async function generateMetadata({ params, searchParams }: PageProps<"/recipes/[id]">): Promise<Metadata> {
  const [{ id }, options] = await Promise.all([params, searchParams]);
  const [recipe, locale] = await Promise.all([getRecipe(id).catch(() => null), getLocale()]);
  const t = makeTranslator(locale, detailMessages);
  if (recipe?.visibility !== "PUBLIC") return { title: t("Recipe"), robots: { index: false, follow: false } };
  return { title: options.edit === "1" ? t("Edit recipe") : recipe.title };
}

function recipeFacts(recipe: RecipeDetailData, locale: Locale) {
  const t = makeTranslator(locale, detailMessages);
  const facts = [[t("Base servings"), formatScaledQuantity(Number(recipe.baseServings), locale)]];
  if (recipe.prepMinutes + recipe.cookMinutes === 0) {
    facts.push([t("Total time"), recipe.source?.estimatedMinutes
      ? t("about {minutes} min", { minutes: recipe.source.estimatedMinutes }) : t("Unknown")]);
  } else {
    facts.push([t("Prep"), t("{minutes} min", { minutes: recipe.prepMinutes })],
      [t("Cook"), t("{minutes} min", { minutes: recipe.cookMinutes })]);
  }
  if (recipe.source) {
    if (recipe.source.difficulty) facts.push([t("Source difficulty"), recipe.source.difficulty]);
  } else {
    facts.push([t("Difficulty"), makeTranslator(locale, difficultyMessages)(difficultyLabels[recipe.difficulty])]);
  }
  return facts;
}

export default async function RecipePage({ params, searchParams }: PageProps<"/recipes/[id]">) {
  const { id } = await params;
  const [recipe, options, locale] = await Promise.all([getRecipe(id), searchParams, getLocale()]);
  const t = makeTranslator(locale, detailMessages);
  if (!recipe) notFound();

  const href = `/recipes/${id}`;
  if (options.edit === "1") {
    if (!recipe.isOwner) notFound();
    return (
      <PageFrame title={t("Edit recipe")} back={{ href, label: t("Back to recipe") }}>
        <RecipeEditor recipe={recipe} units={await getUnitOptions()} />
      </PageFrame>
    );
  }

  const canCopy = recipe.signedIn && recipe.visibility === "PUBLIC";
  const dietary = recipe.dietary;
  const translateReason = makeTranslator<Messages>(locale, detailMessages);
  const texts = [recipe.title, recipe.description, ...recipe.steps.map(step => step.instruction),
    ...recipe.ingredients.flatMap(item => [...(item.translations ? [] : [item.name]), ...(item.note ? [item.note] : [])])];
  const ingredients = recipe.ingredients.map(({ translations, ...item }) => ({ ...item, localizedName: translations?.[locale] }));
  const dietaryNames = new Map(ingredients.map(item => [item.name, item.localizedName]));
  const hasCatalogTranslation = ingredients.some(item => item.localizedName && item.localizedName !== item.name);
  return (
    <RecipeTranslation texts={texts} hasCatalogTranslation={hasCatalogTranslation}>
      <PageFrame title={<RecipeText text={recipe.title} />} back={{ href: "/recipes", label: t("Explore recipes") }}>
        <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)] md:gap-8">
          <div className="flex max-w-3xl flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-subtle">
              {recipe.source && (
                <a href={recipe.source.url} className="underline wrap-anywhere">{t("Original recipe by {cook} on HowToCook", { cook: recipe.source.contributor })}</a>
              )}
              <span className="wrap-anywhere">{t(recipe.source ? "Shared by" : "By")}{" "}
                {recipe.author ? <CookByline cook={recipe.author} /> : t("a home cook")}
              </span>
              <span className="border-s border-line ps-3 font-medium capitalize">{makeTranslator(locale, difficultyMessages)(recipe.visibility === "PUBLIC" ? "Public" : "Private")}</span>
            </div>
            <p className="max-w-[65ch] whitespace-pre-line text-base leading-relaxed text-subtle wrap-anywhere"><RecipeText text={recipe.description} /></p>
            <RecipeTranslationControls />
            <dl className="grid grid-cols-2 gap-x-3 gap-y-3 border-y border-line py-3 sm:grid-cols-4">
              {recipeFacts(recipe, locale).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold text-subtle">{label}</dt>
                  <dd className="mt-1 text-base font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap items-center gap-2">
              <RecipeReactions id={id} title={recipe.title} reactions={recipe.reactions} signedIn={recipe.signedIn} />
              {recipe.isOwner && <ButtonLink className="min-h-11" href={`${href}?edit=1`}>{t("Edit recipe")}</ButtonLink>}
              {recipe.signedIn ? (
                <RecipeActions id={id} title={recipe.title} saved={recipe.saved} canCopy={canCopy} isOwner={recipe.isOwner} afterDeleteHref="/recipes?collection=mine" />
              ) : (
                <ButtonLink variant="outline" className="min-h-11" href={`/account?${new URLSearchParams({ returnTo: href })}`}>{t("Sign in to bookmark")}</ButtonLink>
              )}
            </div>
            {canCopy && (
              <p id="copy-details" className="text-sm text-subtle">{t("You’ll get a private copy you can edit independently. The cover photo stays with the original.")}</p>
            )}
          </div>
          <RecipeCover fileId={recipe.coverFileId} showPlaceholderLabel className="aspect-[4/3] rounded-md border border-line" />
        </div>
        {dietary && (
          <section aria-labelledby="dietary-flags" className="site-panel space-y-3">
            <h2 id="dietary-flags" className="site-heading text-xl">{t("Your dietary flags")}</h2>
            {dietary.conflicts.length ? (
              <div className="space-y-2">
                <h3 className="font-semibold text-rust">{t("Known conflicts")}</h3>
                <dl className="space-y-2">
                  {dietary.conflicts.map(({ ingredient, reasons }, index) => (
                    <div key={index} className="text-sm wrap-anywhere">
                      <dt className="font-semibold"><RecipeText text={ingredient} translation={dietaryNames.get(ingredient) ?? ingredient} /></dt>
                      <dd><ul className="list-disc ps-5 text-subtle">{reasons.map((reason) => <li key={reason}>{translateReason(reason)}</li>)}</ul></dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : <p className="text-sm">{t("No known conflicts in mapped ingredients.")}</p>}
            {dietary.unknownIngredients.length > 0 && (
              <div>
                <h3 className="font-semibold">{t("Incomplete ingredient information")}</h3>
                <p className="text-sm text-subtle">{t("These entries have missing or incomplete records for your settings.")}</p>
                <ul className="list-disc ps-5 text-sm wrap-anywhere">
                  {dietary.unknownIngredients.map((name, index) => <li key={index}><RecipeText text={name} translation={dietaryNames.get(name) ?? name} /></li>)}
                </ul>
              </div>
            )}
            <p className="text-sm text-subtle">{t("Flags use recorded ingredient information. Check product labels and preparation for possible cross-contact.")}</p>
          </section>
        )}
        <div className="grid items-start gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
          <ScalingWorkspace key={recipe.id} recipe={{ baseServings: recipe.baseServings, ingredients }} />
          <section aria-labelledby="method-title" className="min-w-0 border-t border-line pt-4">
            <h2 id="method-title" className="site-heading text-2xl">{t("Method")}</h2>
            <ol className="mt-2 divide-y divide-line">
              {recipe.steps.map((step, index) => (
                <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 py-4" key={step.id}>
                  <span aria-hidden="true" className="pt-0.5 text-sm font-semibold tabular-nums text-subtle">{index + 1}</span>
                  <p className="whitespace-pre-line leading-relaxed text-subtle wrap-anywhere"><RecipeText text={step.instruction} /></p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </PageFrame>
    </RecipeTranslation>
  );
}
