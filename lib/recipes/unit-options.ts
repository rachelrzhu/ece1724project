import "server-only";
import { getDatabase } from "@/lib/db/client";

export async function getUnitOptions() {
  const units = await getDatabase().measurementUnit.findMany({
    where: { menuPosition: { not: null } },
    orderBy: { menuPosition: "asc" },
    select: { symbol: true },
  });
  return units.map(unit => unit.symbol);
}
