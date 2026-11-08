import "server-only";

import { z } from "zod";
import { RecipeCoverError } from "@/lib/recipes/service";
import { ImageValidationError, MAX_IMAGE_BYTES } from "@/lib/storage/image";
import { getBackendTestContext } from "./context";
import { BackendTestError, checkBackendTestRequest } from "./policy";

export function testJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

export async function backendTestRequest(request: Request, operation: (context: Awaited<ReturnType<typeof getBackendTestContext>>) => Promise<Response>) {
  try {
    checkBackendTestRequest(request, process.env.NODE_ENV);
    return await operation(await getBackendTestContext());
  } catch (error) {
    if (error instanceof BackendTestError) return testJson({ error: error.message }, error.status);
    if (error instanceof z.ZodError) return testJson({ error: "Invalid input.", fields: error.issues.map(({ path, message }) => ({ field: path.join("."), message })) }, 400);
    if (error instanceof ImageValidationError || error instanceof RecipeCoverError) return testJson({ error: error.message }, 400);
    return testJson({ error: "Request failed. Check your local database/Blob configuration and backend-test setup." }, 500);
  }
}

export async function limitedBody(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new BackendTestError(400, "A request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.byteLength;
    if (size > limit) { await reader.cancel(); throw new BackendTestError(413, "Request is too large."); }
    chunks.push(result.value);
  }
  return Buffer.concat(chunks, size);
}

export async function recipeBody(request: Request): Promise<unknown> {
  const bytes = await limitedBody(request, 64 * 1024);
  try { return JSON.parse(bytes.toString("utf8")); }
  catch { throw new BackendTestError(400, "Send valid JSON."); }
}

export async function imageBody(request: Request) {
  const bytes = await limitedBody(request, MAX_IMAGE_BYTES + 64 * 1024);
  let form: FormData;
  try {
    form = await new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    throw new BackendTestError(400, "Send valid multipart form data.");
  }
  const file = form.get("image");
  if (!(file instanceof File)) throw new BackendTestError(400, "Choose an image.");
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
}
