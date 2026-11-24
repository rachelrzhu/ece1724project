import RecipeCollection from "@/app/_components/recipe-collection";

export default function Home({ searchParams }: PageProps<"/">) {
  return <RecipeCollection searchParams={searchParams} />;
}
