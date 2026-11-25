import Link from "next/link";
import { SiteWordmark } from "./site-wordmark";
import styles from "./site-footer.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`site-container ${styles.inner}`}>
        <SiteWordmark inverse />
        <nav aria-label="Footer" className={styles.links}>
          <Link href="/recipes">Find recipes</Link>
          <Link href="/recipes/new">Share a recipe</Link>
          <Link href="/account">Your account</Link>
        </nav>
      </div>
    </footer>
  );
}
