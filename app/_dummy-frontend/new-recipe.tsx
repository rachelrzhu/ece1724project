import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/server";
import PageFrame from "./page-frame";
import RecipeEditor from "./recipe-editor";

export default async function NewRecipePage() {
  if (!(await readSession())) redirect("/account");
  return (
    <PageFrame title="Create recipe" back={{ href: "/", label: "Back to recipes" }}>
      <RecipeEditor />
    </PageFrame>
  );
}
