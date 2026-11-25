import Image from "next/image";
import Link from "next/link";
import { publicAvatarImage } from "@/lib/product/avatar";
import { Icon } from "./icons";
import { ButtonLink, Navbar } from "./material";
import { SiteWordmark } from "./site-wordmark";
import styles from "./site-header.module.css";

export const collections = {
  explore: { label: "Explore", heading: "Public recipes", href: "/recipes" },
  mine: { label: "My recipes", heading: "My recipes", href: "/recipes?collection=mine" },
  saved: { label: "Saved", heading: "Saved recipes", href: "/recipes?collection=saved" },
} as const;

export type Collection = keyof typeof collections;
export type HeaderPage = Collection | "home" | "account" | "new";

export function SiteHeader({ user, active }: { user?: { name?: string | null; image?: string | null }; active?: HeaderPage }) {
  const signedIn = Boolean(user);
  const image = publicAvatarImage(user?.image);
  const initial = user?.name?.trim().charAt(0).toUpperCase();
  const accountLabel = signedIn ? "Account" : "Sign in";
  return (
    <Navbar as="header" className="shrink-0 overflow-visible rounded-none border-x-0 border-t-0 border-line bg-paper p-0 shadow-none">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-paper focus:p-3 focus:text-brand">Skip to content</a>
      <div className={`site-container ${styles.inner} ${signedIn ? "" : styles.guest}`}>
        <SiteWordmark />
        <nav aria-label="Recipe navigation" className={styles.nav}>
          <Link href="/" aria-current={active === "home" ? "page" : undefined}>Home</Link>
          {(Object.keys(collections) as Collection[]).filter((key) => signedIn || key === "explore").map((key) => (
            <Link key={key} href={collections[key].href} aria-current={active === key ? "page" : undefined}>
              {collections[key].label}
            </Link>
          ))}
        </nav>
        <div className={styles.actions}>
          <Link href="/account" aria-label={accountLabel} title={accountLabel}
            aria-current={active === "account" ? "page" : undefined} className={styles.account}>
            {image ? <Image src={image} unoptimized width={28} height={28} alt="" className="size-7 rounded-full object-cover" />
              : initial ? <span aria-hidden="true" className={styles.initial}>{initial}</span>
                : <Icon name="account" className="size-[1.125rem]" />}
            <span className={styles.accountLabel}>{accountLabel}</span>
          </Link>
          {signedIn && (
            <ButtonLink href="/recipes/new" aria-label="New recipe" title="New recipe"
              aria-current={active === "new" ? "page" : undefined} isPill className={`min-h-11 gap-1.5 whitespace-nowrap ${styles.create}`}>
              <Icon name="plus" className="size-4" />
              <span>New<span className={styles.recipeLabel}> recipe</span></span>
            </ButtonLink>
          )}
        </div>
      </div>
    </Navbar>
  );
}
