"use client";

import { useId, type ReactNode } from "react";
import { Icon } from "./icons";
import styles from "./site-header.module.css";

export function MobileNavigation({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();

  return (
    <>
      <button type="button" popoverTarget={id} aria-label={label} className={styles.menuButton}>
        <Icon name="menu" className="size-6" />
      </button>
      <nav id={id} popover="auto" aria-label={label} className={styles.menuPanel}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a")) {
            event.currentTarget.hidePopover();
          }
        }}>
        {children}
      </nav>
    </>
  );
}
