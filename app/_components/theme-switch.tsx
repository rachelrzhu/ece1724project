"use client";

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { themeCookie, type Theme } from "@/lib/theme";
import { Icon } from "./icons";
import { useLocale } from "./language-provider";

const ThemeContext = createContext<{ dark: boolean; toggle: () => void } | null>(null);
const darkModeLabels = { en: "Dark mode", fr: "Mode sombre", zh: "深色模式" };
const darkMedia = "(prefers-color-scheme: dark)";

function subscribeToDeviceTheme(onChange: () => void) {
  const media = window.matchMedia(darkMedia);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function ThemeProvider({ initialTheme, children }: { initialTheme?: Theme; children: ReactNode }) {
  const [preference, setPreference] = useState(initialTheme);
  const deviceDark = useSyncExternalStore(subscribeToDeviceTheme, () => window.matchMedia(darkMedia).matches, () => false);
  const dark = preference ? preference === "dark" : deviceDark;

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.cookie = `${themeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setPreference(next);
  }

  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}

export function ThemeSwitch() {
  const label = darkModeLabels[useLocale()];
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("ThemeSwitch requires a ThemeProvider.");
  return (
    <button type="button" role="switch" aria-label={label} aria-checked={theme.dark} title={label}
      className="inline-grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-subtle hover:bg-tint hover:text-brand"
      onClick={theme.toggle}>
      <Icon name="moon" className="size-5 dark:hidden" />
      <Icon name="sun" className="hidden size-5 dark:block" />
    </button>
  );
}
