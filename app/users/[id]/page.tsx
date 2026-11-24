import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RecipeCollection from "@/app/_components/recipe-collection";
import { getPublicCook } from "@/lib/product/queries";

export async function generateMetadata({ params }: PageProps<"/users/[id]">): Promise<Metadata> {
  const cook = await getPublicCook((await params).id);
  return { title: cook ? `${cook.name || cook.username}’s public recipes` : "Cook unavailable" };
}

export default async function PublicCookPage({ params, searchParams }: PageProps<"/users/[id]">) {
  const cook = await getPublicCook((await params).id);
  if (!cook) notFound();
  return <RecipeCollection cook={cook} searchParams={searchParams} />;
}
