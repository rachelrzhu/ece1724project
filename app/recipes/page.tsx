import type { Metadata } from "next";
import { discoveryTranslator } from "@/lib/i18n/discovery";
import { getLocale } from "@/lib/i18n/server";
import RecipeCollection from "@/app/_components/recipe-collection";

export async function generateMetadata(): Promise<Metadata> {
  const t = discoveryTranslator(await getLocale());
  return { title: t("Browse recipes") };
}

export default function BrowseRecipes({ searchParams }: PageProps<"/recipes">) {
  return <RecipeCollection searchParams={searchParams} />;
}
