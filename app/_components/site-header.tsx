import Image from "next/image";
import Link from "next/link";
import { makeTranslator } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { siteMessages } from "@/lib/i18n/site";
import { publicAvatarImage } from "@/lib/product/avatar";
import { Icon } from "./icons";
import { LanguageSelect } from "./language-select";
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

export async function SiteHeader({ user, active }: { user?: { name?: string | null; image?: string | null }; active?: HeaderPage }) {
  const t = makeTranslator(await getLocale(), siteMessages);
  const signedIn = Boolean(user);
  const image = publicAvatarImage(user?.image);
  const initial = user?.name?.trim().charAt(0).toUpperCase();
  const accountLabel = t(signedIn ? "Account" : "Sign in");
  return (
    <Navbar as="header" className="shrink-0 overflow-visible rounded-none border-x-0 border-t-0 border-line bg-paper p-0 shadow-none">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-paper focus:p-3 focus:text-brand">{t("Skip to content")}</a>
      <div className={`site-container ${styles.inner} ${signedIn ? "" : styles.guest}`}>
        <SiteWordmark />
        <nav aria-label={t("Recipe navigation")} className={styles.nav}>
          <Link href="/" aria-current={active === "home" ? "page" : undefined}>{t("Home")}</Link>
          {(Object.keys(collections) as Collection[]).filter((key) => signedIn || key === "explore").map((key) => (
            <Link key={key} href={collections[key].href} aria-current={active === key ? "page" : undefined}>
              {t(collections[key].label)}
            </Link>
          ))}
        </nav>
        <div className={styles.actions}>
          <LanguageSelect />
          <Link href="/account" aria-label={accountLabel} title={accountLabel}
            aria-current={active === "account" ? "page" : undefined} className={styles.account}>
            {image ? <Image src={image} unoptimized width={28} height={28} alt="" className="size-7 rounded-full object-cover" />
              : initial ? <span aria-hidden="true" className={styles.initial}>{initial}</span>
                : <Icon name="account" className="size-[1.125rem]" />}
            <span className={styles.accountLabel}>{accountLabel}</span>
          </Link>
          {signedIn && (
            <ButtonLink href="/recipes/new" aria-label={t("New recipe")} title={t("New recipe")}
              aria-current={active === "new" ? "page" : undefined} isPill className={`min-h-11 gap-1.5 whitespace-nowrap ${styles.create}`}>
              <Icon name="plus" className="size-4" />
              <span className={styles.shortLabel}>{t("New")}</span>
              <span className={styles.recipeLabel}>{t("New recipe")}</span>
            </ButtonLink>
          )}
        </div>
      </div>
    </Navbar>
  );
}
