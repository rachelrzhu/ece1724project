import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PageFrame from "@/app/_components/page-frame";
import { readSession } from "@/lib/auth/server";
import RecipeEditor from "../_components/recipe-editor";

export const metadata: Metadata = { title: "Create recipe" };

export default async function NewRecipePage() {
  if (!(await readSession())) redirect("/account?returnTo=%2Frecipes%2Fnew");
  return (
    <PageFrame title="Create recipe" back={{ href: "/?collection=mine", label: "My recipes" }}>
      <RecipeEditor />
    </PageFrame>
  );
}
