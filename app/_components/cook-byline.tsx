import { discoveryTranslator } from "@/lib/i18n/discovery";
import { getLocale } from "@/lib/i18n/server";
import Link from "next/link";

export async function CookByline({ cook, displayNameOnly = false }: {
  cook: { id: string; name: string | null; username: string };
  displayNameOnly?: boolean;
}) {
  const t = discoveryTranslator(await getLocale());
  return (
    <Link href={`/users/${cook.id}`} className="relative z-10 underline">
      {displayNameOnly ? cook.name?.trim() || t("Home cook") : [cook.name, `@${cook.username}`].filter(Boolean).join(" ")}
    </Link>
  );
}
