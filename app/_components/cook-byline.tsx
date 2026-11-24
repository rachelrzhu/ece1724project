import Link from "next/link";

export function CookByline({ cook }: { cook: { id: string; name: string | null; username: string } }) {
  return (
    <Link href={`/users/${cook.id}`} className="relative z-10 underline">
      {cook.name && `${cook.name} `}@{cook.username}
    </Link>
  );
}
