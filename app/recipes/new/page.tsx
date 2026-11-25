import { editorText } from "@/lib/i18n/editor";
import { getLocale } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PageFrame from "@/app/_components/page-frame";
import { readSession } from "@/lib/auth/server";
import { getUnitOptions } from "@/lib/recipes/unit-options";
import RecipeEditor from "../_components/recipe-editor";

export async function generateMetadata(): Promise<Metadata> {
  return { title: editorText(await getLocale())("Create recipe") };
}

export default async function NewRecipePage() {
  if (!(await readSession())) redirect("/account?returnTo=%2Frecipes%2Fnew");
  const t = editorText(await getLocale());
  return (
    <PageFrame title={t("Create recipe")} back={{ href: "/recipes?collection=mine", label: t("My recipes") }}>
      <RecipeEditor units={await getUnitOptions()} />
    </PageFrame>
  );
}
