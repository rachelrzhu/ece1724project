import { getAuth } from "@/lib/auth/server";

const maxBodyBytes = 16 * 1024;

export async function GET(request: Request) {
  return getAuth().handler(request);
}
export async function POST(request: Request) {
  const tooLarge = () => Response.json({ message: "Account request is too large." }, { status: 413 });
  if (Number(request.headers.get("content-length")) > maxBodyBytes) return tooLarge();
  if (!request.body) return getAuth().handler(request);

  // Count the actual body as it arrives, including requests without a length header.
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBodyBytes) {
        await reader.cancel();
        return tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return getAuth().handler(new Request(request.url, {
    method: "POST", headers: request.headers, body: Buffer.concat(chunks), signal: request.signal,
  }));
}
