import { backendTestRequest, recipeBody, testJson } from "@/lib/backend-test/http";
import { BackendTestError } from "@/lib/backend-test/policy";

export const runtime = "nodejs";

function idFrom(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) throw new BackendTestError(400, "Select a recipe first.");
  return id;
}

export function GET(request: Request) {
  return backendTestRequest(request, async ({ recipes }) => {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return testJson({ recipes: await recipes.listOwn() });
    const recipe = await recipes.getById(id);
    if (!recipe) throw new BackendTestError(404, "Recipe not found.");
    return testJson({ recipe });
  });
}

export function POST(request: Request) {
  return backendTestRequest(request, async ({ recipes }) => {
    const created = await recipes.create(await recipeBody(request));
    return testJson({ recipe: await recipes.getById(created.id) }, 201);
  });
}

export function PATCH(request: Request) {
  return backendTestRequest(request, async ({ recipes }) => {
    const updated = await recipes.update(idFrom(request), await recipeBody(request));
    if (!updated) throw new BackendTestError(404, "Recipe not found.");
    return testJson({ recipe: await recipes.getById(updated.id) });
  });
}

export function DELETE(request: Request) {
  return backendTestRequest(request, async ({ recipes }) => {
    if (!await recipes.remove(idFrom(request))) throw new BackendTestError(404, "Recipe not found.");
    return testJson({ deleted: true });
  });
}
