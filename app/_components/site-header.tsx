import Link from "next/link";
import { Icon } from "./icons";

export const collections = {
  explore: { label: "Explore", heading: "Public recipes", href: "/" },
  mine: { label: "My recipes", heading: "My recipes", href: "/?collection=mine" },
  saved: { label: "Saved", heading: "Saved recipes", href: "/?collection=saved" },
} as const;

export type Collection = keyof typeof collections;

export function SiteHeader({ signedIn, active }: { signedIn: boolean; active?: Collection }) {
  return (
    <header className="border-b border-line bg-paper">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-paper focus:p-3">Skip to content</a>
      <div className="site-container flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3 sm:min-h-18 sm:flex-nowrap sm:py-0">
        <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg text-2xl font-serif font-bold tracking-tight">
          <span className="grid size-9 place-items-center rounded-[0.7rem] bg-brand text-white">
            <Icon name="brand" className="size-6" />
          </span>
          Savor
        </Link>
        <nav aria-label="Recipe navigation" className="order-3 flex w-full flex-wrap items-center gap-1 sm:order-none sm:w-auto sm:gap-2">
          {(Object.keys(collections) as Collection[]).filter((key) => signedIn || key === "explore").map((key) => (
            <Link key={key} href={collections[key].href} className="site-nav-link"
              aria-current={active === key ? "page" : undefined}>
              {collections[key].label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/account" className="site-nav-link">
            <Icon name="account" className="size-4" />
            {signedIn ? "Account" : "Sign in"}
          </Link>
          {signedIn && (
            <Link href="/recipes/new" className="site-button">
              <Icon name="plus" className="size-4" /> New recipe
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
