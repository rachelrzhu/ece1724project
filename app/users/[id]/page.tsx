import type { Metadata } from "next";
import { discoveryTranslator } from "@/lib/i18n/discovery";
import { getLocale } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import RecipeCollection from "@/app/_components/recipe-collection";
import { getPublicCook } from "@/lib/product/queries";

export async function generateMetadata({ params }: PageProps<"/users/[id]">): Promise<Metadata> {
  const [cook, locale] = await Promise.all([getPublicCook((await params).id), getLocale()]);
  const t = discoveryTranslator(locale);
  return { title: cook ? t("{name}’s recipes", { name: cook.name || cook.username }) : t("Cook unavailable") };
}

export default async function PublicCookPage({ params, searchParams }: PageProps<"/users/[id]">) {
  const cook = await getPublicCook((await params).id);
  if (!cook) notFound();
  return <RecipeCollection cook={cook} searchParams={searchParams} />;
}
