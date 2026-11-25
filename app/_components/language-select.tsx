"use client";

import { useSyncExternalStore, useTransition } from "react";
import { setSiteLanguage } from "@/app/language-action";
import { isLocale, languageNames } from "@/lib/i18n";
import { useLocale } from "./language-provider";
import styles from "./site-header.module.css";

const labels = { en: "Site language", zh: "网站语言", fr: "Langue du site" };

// The server-rendered control can accept changes only after React attaches its handler.
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function LanguageSelect() {
  const locale = useLocale();
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [pending, startTransition] = useTransition();
  return (
    <span className={styles.language}>
      <select aria-label={labels[locale]} value={locale} disabled={!ready || pending}
        className="min-h-11 cursor-pointer rounded-full border border-line bg-paper px-2 text-sm font-medium text-ink hover:border-brand disabled:cursor-wait"
        onChange={({ currentTarget }) => {
          const value = currentTarget.value;
          if (isLocale(value)) startTransition(() => setSiteLanguage(value));
        }}>
        {Object.entries(languageNames).map(([value, name]) =>
          <option key={value} value={value} lang={value}>{name}</option>)}
      </select>
      <span className={styles.languageCode} aria-hidden="true">{locale === "zh" ? "中文" : locale.toUpperCase()}</span>
    </span>
  );
}
