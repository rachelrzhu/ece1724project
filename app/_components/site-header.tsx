import Link from "next/link";
import { appName } from "@/lib/brand";
import { Icon } from "./icons";

export const collections = {
  explore: { label: "Explore", heading: "Public recipes", href: "/" },
  mine: { label: "My recipes", heading: "My recipes", href: "/?collection=mine" },
  saved: { label: "Saved", heading: "Saved recipes", href: "/?collection=saved" },
} as const;

export type Collection = keyof typeof collections;

export function SiteHeader({ signedIn, active }: { signedIn: boolean; active?: Collection }) {
  return (
    <header className={`border-b border-line bg-paper ${signedIn ? "" : "site-header-guest"}`}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-paper focus:p-3">Skip to content</a>
      <div className="site-container site-header-grid">
        <Link href="/" className="site-wordmark masthead-brand">
          <Icon name="brand" className="size-5 shrink-0 text-brand" />
          {appName}
        </Link>
        <nav aria-label="Recipe navigation" className="masthead-nav flex flex-wrap items-center gap-0.5 md:ms-4 md:gap-1">
          {(Object.keys(collections) as Collection[]).filter((key) => signedIn || key === "explore").map((key) => (
            <Link key={key} href={collections[key].href} className="site-nav-link"
              aria-current={active === key ? "page" : undefined}>
              {collections[key].label}
            </Link>
          ))}
        </nav>
        <Link href="/account" className="site-nav-link masthead-account">
          <Icon name="account" className="size-4" />
          {signedIn ? "Account" : "Sign in"}
        </Link>
        {signedIn && (
          <Link href="/recipes/new" aria-label="New recipe" className="site-button masthead-create">
            <Icon name="plus" className="size-4" />
            <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">New recipe</span>
          </Link>
        )}
      </div>
    </header>
  );
}
