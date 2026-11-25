"use client";

import { useOptimistic, useSyncExternalStore, useTransition } from "react";
import { setSiteLanguage } from "@/app/language-action";
import { languageNames, type Locale } from "@/lib/i18n";
import { useLocale } from "./language-provider";
import styles from "./language-select.module.css";

const labels = { en: "Site language", zh: "网站语言", fr: "Langue du site" };
const choices = [
  { value: "en", label: "EN" },
  { value: "fr", label: "FR" },
  { value: "zh", label: "中" },
] as const satisfies ReadonlyArray<{ value: Locale; label: string }>;

// The server-rendered control can accept changes only after React attaches its handler.
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function LanguageSelect() {
  const locale = useLocale();
  const [selected, setSelected] = useOptimistic(locale);
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [pending, startTransition] = useTransition();

  function chooseLanguage(value: Locale) {
    startTransition(async () => {
      setSelected(value);
      await setSiteLanguage(value);
    });
  }

  return (
    <fieldset aria-label={labels[locale]} aria-busy={pending} disabled={!ready} className={styles.picker}>
      {choices.map(({ value, label }) => (
        <label key={value} className={styles.choice} lang={value} title={languageNames[value]}>
          <input type="radio" name="site-language" value={value} checked={selected === value}
            aria-label={languageNames[value]}
            onChange={() => chooseLanguage(value)} />
          <span aria-hidden="true">{label}</span>
        </label>
      ))}
    </fieldset>
  );
}
