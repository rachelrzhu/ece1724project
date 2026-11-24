import { z } from "zod";
import { getDatabase } from "@/lib/db/client";
import { readSession } from "@/lib/auth/server";
import { productImageStore } from "@/lib/product/storage";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const noStore = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (!z.uuid().safeParse(id).success)
    return new Response(null, { status: 404, headers: noStore });
  const session = await readSession();
  const file = await getDatabase().storedFile.findFirst({
    where: {
      id,
      OR: [
        { coverOf: { is: { visibility: "PUBLIC" } } },
        { owner: { image: `/api/images/${id}` } },
        ...(session ? [{ ownerId: session.user.id }] : []),
      ],
    },
    select: { pathname: true, contentType: true },
  });
  if (!file) return new Response(null, { status: 404, headers: noStore });
  const stream = await productImageStore().read(file.pathname);
  return new Response(stream, {
    status: stream ? 200 : 404,
    headers: { ...noStore, "Content-Type": file.contentType },
  });
}
