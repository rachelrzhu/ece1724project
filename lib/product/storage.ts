import "server-only";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { privateImageStore, type PrivateImageStore } from "@/lib/storage/blob";
import { isLocalPoc } from "./local";
function filePath(name: string) {
  const root = path.resolve(process.cwd(), ".local-poc/media");
  const target = path.resolve(root, name);
  if (!target.startsWith(root + path.sep))
    throw new Error("Invalid image path.");
  return target;
}
const localStore: PrivateImageStore = {
  async put(name, bytes) {
    const file = filePath(name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
  },
  async read(name) {
    try {
      const bytes = await readFile(filePath(name));
      return new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  },
  async remove(name) {
    await rm(filePath(name), { force: true });
  },
};
export function productImageStore() {
  return isLocalPoc() ? localStore : privateImageStore;
}
