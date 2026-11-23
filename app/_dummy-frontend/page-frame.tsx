import { LinkRoot as Link } from "@heroui/react/link";
import type { ReactNode } from "react";

export default function PageFrame({ title, back, children }: {
  title: string;
  back?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
      <header className="space-y-2">
        {back && <Link href={back.href}>{back.label}</Link>}
        <h1 className="text-2xl font-semibold wrap-anywhere">{title}</h1>
      </header>
      {children}
    </main>
  );
}
