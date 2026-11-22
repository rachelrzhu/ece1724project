import { z } from "zod";
import { backendTestRequest, imageBody, testJson } from "@/lib/backend-test/http";
import { BackendTestError } from "@/lib/backend-test/policy";
import { privateImageStore } from "@/lib/storage/blob";

export const runtime = "nodejs";

function idFrom(request: Request) {
  return z.uuid().parse(new URL(request.url).searchParams.get("id"));
}

export function GET(request: Request) {
  return backendTestRequest(request, async ({ images }) => {
    const image = await images.readOwn(idFrom(request));
    if (!image) throw new BackendTestError(404, "Image not found.");
    return new Response(image.stream, { headers: { "Content-Type": image.contentType, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  });
}

export function POST(request: Request) {
  return backendTestRequest(request, async ({ images }) => {
    return testJson({ image: await images.upload(await imageBody(request)) }, 201);
  });
}

export function DELETE(request: Request) {
  return backendTestRequest(request, async ({ database, ownerId }) => {
    const id = idFrom(request);
    const file = await database.storedFile.findFirst({ where: { id, ownerId }, select: { pathname: true, coverOf: { select: { id: true } } } });
    if (!file) throw new BackendTestError(404, "Image not found.");
    if (file.coverOf) throw new BackendTestError(409, "Remove the image from the recipe or delete the recipe first.");
    await privateImageStore.remove(file.pathname);
    await database.storedFile.delete({ where: { id, ownerId } });
    return testJson({ deleted: true });
  });
}
