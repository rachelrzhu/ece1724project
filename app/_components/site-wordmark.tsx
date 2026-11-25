import Link from "next/link";
import { appName } from "@/lib/brand";
import { Icon } from "./icons";
import styles from "./site-header.module.css";

export function SiteWordmark() {
  return (
    <Link href="/" className={styles.wordmark}>
      <span className={styles.bookMark}>
        <Icon name="brand" className="size-5" />
      </span>
      {appName}
    </Link>
  );
}
