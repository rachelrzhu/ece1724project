import Link from "next/link";

export function CookByline({ cook, displayNameOnly = false }: {
  cook: { id: string; name: string | null; username: string };
  displayNameOnly?: boolean;
}) {
  return (
    <Link href={`/users/${cook.id}`} className="relative z-10 underline">
      {displayNameOnly ? cook.name?.trim() || "Home cook" : [cook.name, `@${cook.username}`].filter(Boolean).join(" ")}
    </Link>
  );
}
