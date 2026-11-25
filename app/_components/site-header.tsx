import Image from "next/image";
import Link from "next/link";
import { appName } from "@/lib/brand";
import { publicAvatarImage } from "@/lib/product/avatar";
import { Icon } from "./icons";
import { ButtonLink, Navbar } from "./material";

export const collections = {
  explore: { label: "Explore", heading: "Public recipes", href: "/recipes" },
  mine: { label: "My recipes", heading: "My recipes", href: "/recipes?collection=mine" },
  saved: { label: "Saved", heading: "Saved recipes", href: "/recipes?collection=saved" },
} as const;

export type Collection = keyof typeof collections;

export function SiteHeader({ user, active }: { user?: { name?: string | null; image?: string | null }; active?: Collection | "home" }) {
  const signedIn = Boolean(user);
  const image = publicAvatarImage(user?.image);
  return (
    <Navbar as="header" color="primary" className={`site-app-bar overflow-visible rounded-none border-0 p-0 shadow-md ${signedIn ? "" : "site-header-guest"}`}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-paper focus:p-3">Skip to content</a>
      <div className="site-container site-header-grid">
        <Link href="/" className="site-wordmark masthead-brand">
          <span className="masthead-mark"><Icon name="brand" className="size-5" /></span>
          {appName}
        </Link>
        <nav aria-label="Recipe navigation" className="masthead-nav flex flex-wrap items-center gap-0.5 md:ms-4 md:gap-1">
          <Link href="/" className="site-nav-link masthead-home" aria-current={active === "home" ? "page" : undefined}>Home</Link>
          {(Object.keys(collections) as Collection[]).filter((key) => signedIn || key === "explore").map((key) => (
            <Link key={key} href={collections[key].href} className="site-nav-link"
              aria-current={active === key ? "page" : undefined}>
              {collections[key].label}
            </Link>
          ))}
        </nav>
        <Link href="/account" className="site-nav-link masthead-account border border-white/60">
          {image ? <Image src={image} unoptimized width={24} height={24} alt="" className="size-6 rounded-full object-cover" />
            : user?.name ? <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-brand text-xs text-white">{user.name.trim().charAt(0).toUpperCase()}</span>
              : <Icon name="account" className="size-4" />}
          {signedIn ? "Account" : "Sign in"}
        </Link>
        {signedIn && (
          <ButtonLink href="/recipes/new" aria-label="New recipe" isPill color="secondary" className="masthead-create min-h-11 gap-2">
            <Icon name="plus" className="size-4" />
            <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">New recipe</span>
          </ButtonLink>
        )}
      </div>
    </Navbar>
  );
}
