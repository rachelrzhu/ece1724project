import type { Metadata } from "next";
import RecipeCollection from "@/app/_components/recipe-collection";

export const metadata: Metadata = { title: "Browse recipes" };

export default function BrowseRecipes({ searchParams }: PageProps<"/recipes">) {
  return <RecipeCollection searchParams={searchParams} />;
}
