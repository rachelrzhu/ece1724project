import "server-only";

import { BlobNotFoundError, del, get, put } from "@vercel/blob";
import { readBlobEnvironment } from "@/lib/config/env";

export interface PrivateImageStore {
  put(pathname: string, bytes: Uint8Array, contentType: string): Promise<void>;
  read(pathname: string): Promise<ReadableStream<Uint8Array> | null>;
  remove(pathname: string): Promise<void>;
}

function options() {
  const { BLOB_READ_WRITE_TOKEN } = readBlobEnvironment(process.env);
  return { token: BLOB_READ_WRITE_TOKEN, abortSignal: AbortSignal.timeout(30_000) };
}

export const privateImageStore: PrivateImageStore = {
  async put(pathname, bytes, contentType) {
    await put(pathname, Buffer.from(bytes), {
      ...options(),
      access: "private",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
  },
  async read(pathname) {
    try {
      const result = await get(pathname, { ...options(), access: "private", useCache: false });
      return result?.statusCode === 200 ? result.stream : null;
    } catch (error) {
      if (error instanceof BlobNotFoundError) return null;
      throw error;
    }
  },
  async remove(pathname) {
    await del(pathname, options());
  },
};
