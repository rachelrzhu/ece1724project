import { LinkRoot as Link } from "@heroui/react/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/server";
import RecipeEditor from "./recipe-editor";

export default async function NewRecipePage() {
  if (!(await readSession())) redirect("/account");
  return (
    <main>
      <Link href="/">Back to recipes</Link>
      <h1>Create recipe</h1>
      <RecipeEditor />
    </main>
  );
}
