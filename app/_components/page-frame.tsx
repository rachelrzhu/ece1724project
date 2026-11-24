import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/app/_components/icons";
import { SiteHeader } from "@/app/_components/site-header";
import { readSession } from "@/lib/auth/server";

export default async function PageFrame({ title, back, children, narrow = false }: {
  title: string;
  back?: { href: string; label: string };
  children: ReactNode;
  narrow?: boolean;
}) {
  const session = await readSession().catch(() => null);

  return (
    <>
      <SiteHeader signedIn={Boolean(session)} />
      <main id="main-content" tabIndex={-1} className={`site-container space-y-6 py-6 sm:space-y-8 sm:py-9 ${narrow ? "max-w-xl!" : ""}`}>
        <header className="space-y-2">
          {back && (
            <Link href={back.href} className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-subtle hover:text-brand">
              <Icon name="back" className="size-4" />{back.label}
            </Link>
          )}
          <h1 className="site-heading text-3xl sm:text-4xl">{title}</h1>
        </header>
        {children}
      </main>
    </>
  );
}
