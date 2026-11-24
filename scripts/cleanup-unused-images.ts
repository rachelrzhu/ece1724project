import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const { isLocalPoc } = await import("../lib/product/local");
const { getDatabase } = await import("../lib/db/client");
const { productImageStore } = await import("../lib/product/storage");
if (!isLocalPoc())
  throw new Error("This cleanup is restricted to the local POC database.");
const db = getDatabase();
const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
const files = await db.storedFile.findMany({
  where: { coverOf: { is: null }, createdAt: { lt: cutoff } },
  select: { id: true, pathname: true },
});
let removed = 0;
for (const file of files) {
  await db.$transaction(async (tx) => {
    // A recipe may have attached this image since the scan. Lock it before checking again.
    await tx.$queryRaw`SELECT id FROM files WHERE id = ${file.id}::uuid FOR UPDATE`;
    const existing = await tx.storedFile.findFirst({
      where: { id: file.id, coverOf: { is: null } },
      select: { owner: { select: { image: true } } },
    });
    if (!existing || existing.owner.image === `/api/images/${file.id}`) return;
    await tx.storedFile.delete({ where: { id: file.id } });
    await productImageStore().remove(file.pathname);
    removed++;
  });
}
await db.$disconnect();
console.log(`Removed ${removed} unattached local images older than 24 hours.`);
