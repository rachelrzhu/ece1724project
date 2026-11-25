import Image from "next/image";
import Link from "next/link";
import { makeTranslator } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { siteMessages } from "@/lib/i18n/site";
import { publicAvatarImage } from "@/lib/product/avatar";
import { Icon } from "./icons";
import { LanguageSelect } from "./language-select";
import { MobileNavigation } from "./mobile-navigation";
import { SiteWordmark } from "./site-wordmark";
import { ThemeSwitch } from "./theme-switch";
import styles from "./site-header.module.css";

export const collections = {
  explore: { label: "Find recipes", heading: "Public recipes", href: "/recipes", icon: "search" },
  mine: { label: "My recipes", heading: "My recipes", href: "/recipes?collection=mine", icon: "brand" },
  saved: { label: "Saved", heading: "Saved recipes", href: "/recipes?collection=saved", icon: "bookmark" },
} as const;

export type Collection = keyof typeof collections;
export type HeaderPage = Collection | "home" | "account" | "new";

export async function SiteHeader({ user, active }: { user?: { name?: string | null; image?: string | null }; active?: HeaderPage }) {
  const t = makeTranslator(await getLocale(), siteMessages);
  const image = publicAvatarImage(user?.image);
  const initial = user?.name?.trim().charAt(0).toUpperCase();
  const links = (
    <>
      <Link href="/" aria-current={active === "home" ? "page" : undefined}>
        <Icon name="home" className={styles.linkIcon} />{t("Home")}
      </Link>
      {(Object.keys(collections) as Collection[]).filter((key) => user || key === "explore").map((key) => (
        <Link key={key} href={collections[key].href} aria-current={active === key ? "page" : undefined}>
          <Icon name={collections[key].icon} className={styles.linkIcon} />{t(collections[key].label)}
        </Link>
      ))}
      <Link href="/recipes/new" className={styles.share} aria-current={active === "new" ? "page" : undefined}>
        <Icon name="plus" className="size-4 shrink-0" />{t("Share a recipe")}
      </Link>
      <Link href="/account" className={styles.account} aria-current={active === "account" ? "page" : undefined}>
        {image ? <Image src={image} unoptimized width={26} height={26} alt="" className="size-6 shrink-0 rounded-full object-cover" />
          : initial ? <span aria-hidden="true" className={styles.initial}>{initial}</span>
            : <Icon name="account" className="size-[1.125rem] shrink-0" />}
        <span className={styles.desktopLabel}>{t(user ? "Account" : "Sign in")}</span>
        <span className={styles.mobileLabel}>{t(user ? "Account settings" : "Sign in")}</span>
      </Link>
    </>
  );
  return (
    <header className={styles.header}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-paper focus:p-3 focus:text-brand">{t("Skip to content")}</a>
      <div className={`site-container ${styles.inner} ${user ? "" : styles.guest}`}>
        <MobileNavigation label={t("Navigation menu")}>{links}</MobileNavigation>
        <SiteWordmark />
        <nav aria-label={t("Recipe navigation")} className={styles.desktopNav}>{links}</nav>
        <div className={styles.tools}>
          <LanguageSelect />
          <ThemeSwitch />
        </div>
      </div>
    </header>
  );
}
