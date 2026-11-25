import Link from "next/link";
import { makeTranslator, type Locale } from "@/lib/i18n";
import { siteMessages } from "@/lib/i18n/site";
import { SiteWordmark } from "./site-wordmark";
import styles from "./site-footer.module.css";

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = makeTranslator(locale, siteMessages);
  return (
    <footer className={styles.footer}>
      <div className={`site-container ${styles.inner}`}>
        <SiteWordmark inverse />
        <nav aria-label={t("Footer")} className={styles.links}>
          <Link href="/recipes">{t("Find recipes")}</Link>
          <Link href="/recipes/new">{t("Share a recipe")}</Link>
          <Link href="/account">{t("Your account")}</Link>
        </nav>
      </div>
    </footer>
  );
}
