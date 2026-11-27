"use client";

import { createContext, useCallback, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { isLocale, languageNames, makeTranslator, type Locale } from "@/lib/i18n";
import { translateRecipe, type BeginDownload, type BrowserLanguageTools } from "@/lib/i18n/on-device";
import { useLocale } from "./language-provider";
import { Button } from "./material";

const messages = {
  "Original recipe language": ["食谱原文语言", "Langue d’origine de la recette"],
  "Choose a language": ["选择语言", "Choisir une langue"],
  "Enable language detection": ["启用语言识别", "Activer la détection de langue"],
  "Enable recipe translation": ["启用食谱翻译", "Activer la traduction de la recette"],
  "Translating on this device…": ["正在此设备上翻译…", "Traduction sur cet appareil…"],
  "Downloading language tools… {percent}%": ["正在下载语言工具… {percent}%", "Téléchargement des outils linguistiques… {percent} %"],
  "Some text is shown in its original language.": ["部分内容以原文显示。", "Une partie du texte est affichée dans sa langue d’origine."],
  "Retry translation": ["重试翻译", "Réessayer la traduction"],
  "Show original": ["查看原文", "Afficher l’original"],
  "Show translation": ["查看译文", "Afficher la traduction"],
  "Showing the original recipe. On-device translation is unavailable.": [
    "此设备暂时无法翻译，已显示食谱原文。", "La traduction sur cet appareil est indisponible. La recette s’affiche dans sa langue d’origine.",
  ],
} as const;

type Status = "working" | "downloading" | "ready" | "unavailable" | "detector" | "translator";
type Translation = { status: Status; strings?: Map<string, string>; needsSource?: boolean; enable?: () => void; percent?: number; canRetry?: boolean };
type CatalogText = Readonly<Record<string, string>>;
// A model installed for one card is available to other cards from the same origin.
const installedModels = new EventTarget();
const activatedModels = new Set<string>();

const TranslationContext = createContext<{
  result: Translation; hasCatalogTranslation: boolean; catalogText?: CatalogText; original: boolean; toggle: () => void;
  selectSource?: (source: Locale) => void; retry: () => void;
} | null>(null);

export function RecipeTranslation({ texts, hasCatalogTranslation = false, catalogText, children }: {
  texts: readonly string[]; hasCatalogTranslation?: boolean; catalogText?: CatalogText; children: ReactNode;
}) {
  const target = useLocale();
  // Scope edits and language changes to a new translation job, without remounting the recipe's controls.
  const [state, setState] = useState<{ texts: readonly string[]; target: string; result: Translation } | null>(null);
  const [originalFor, setOriginalFor] = useState<{ texts: readonly string[]; target: Locale } | null>(null);
  const original = originalFor?.texts === texts && originalFor.target === target;
  const [source, setSource] = useState<{ texts: readonly string[]; locale: Locale } | null>(null);
  const fallbackSource = source?.texts === texts ? source.locale : undefined;
  const [attempt, setAttempt] = useState(0);
  const result: Translation = state?.texts === texts && state.target === target ? state.result : { status: texts.length ? "working" : "ready" };

  useEffect(() => {
    if (!texts.length) return;
    const job = new AbortController();
    const { signal } = job;
    let partial: Map<string, string> | undefined;
    function update(result: Translation) {
      if (!signal.aborted) setState({ texts, target, result: { strings: partial, ...result } });
    }
    // Invoke create() directly from the click handler while user activation is still available.
    const beginDownload: BeginDownload = (model, create, modelId) => new Promise((resolve, reject) => {
      signal.throwIfAborted();
      let started = false;
      function cancel() {
        installedModels.removeEventListener(modelId, onInstalled);
        if (!started) reject(signal.reason);
      }
      async function start(fromClick: boolean) {
        if (started || signal.aborted) return;
        started = true;
        update({ status: "working" });
        try {
          const instance = await create();
          resolve(instance);
          if (!activatedModels.has(modelId) || fromClick) {
            activatedModels.add(modelId);
            installedModels.dispatchEvent(new Event(modelId));
          }
        } catch (error) {
          if (!fromClick && !signal.aborted && error instanceof DOMException && error.name === "NotAllowedError") {
            started = false;
            update({ status: model, enable: () => void start(true) });
            return;
          }
          reject(error);
        }
        installedModels.removeEventListener(modelId, onInstalled);
        signal.removeEventListener("abort", cancel);
      }
      function onInstalled() { void start(false); }
      signal.addEventListener("abort", cancel, { once: true });
      installedModels.addEventListener(modelId, onInstalled);
      if (activatedModels.has(modelId) || navigator.userActivation?.isActive) void start(false);
      else update({ status: model, enable: () => void start(true) });
    });
    translateRecipe(window as BrowserLanguageTools, texts, target, signal, beginDownload, fallbackSource, strings => {
      partial = new Map(strings);
      update({ status: "working" });
    }, fraction => update(fraction < 1 ? { status: "downloading", percent: Math.round(100 * fraction) } : { status: "working" }))
      .then(result => update(result
        ? { status: result.incomplete ? "unavailable" : "ready", strings: result.strings, needsSource: result.needsSource, canRetry: result.canRetry }
        : { status: "unavailable" }))
      .catch(() => update({ status: "unavailable", canRetry: true }));
    return () => job.abort();
  }, [texts, target, fallbackSource, attempt]);

  return (
    <TranslationContext.Provider value={{
      result, catalogText, hasCatalogTranslation: hasCatalogTranslation || Boolean(catalogText && Object.keys(catalogText).length), original,
      toggle: () => setOriginalFor(original ? null : { texts, target }), retry: () => setAttempt(value => value + 1),
      selectSource: result.needsSource ? locale => setSource({ texts, locale }) : undefined,
    }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useRecipeTranslation() {
  const context = useContext(TranslationContext);
  const original = context?.original ?? false;
  const strings = context?.result.strings;
  const catalogText = context?.catalogText;
  const lookup = useCallback((text: string, catalogLabel?: string) => {
    if (original) return text;
    const curated = catalogText && Object.hasOwn(catalogText, text) ? catalogText[text] : undefined;
    return catalogLabel ?? curated ?? strings?.get(text) ?? text;
  }, [original, catalogText, strings]);
  return { lookup };
}

export function useRecipeText(text: string) {
  return useRecipeTranslation().lookup(text);
}

export function RecipeText({ text, translation }: { text: string; translation?: string }) {
  const { lookup } = useRecipeTranslation();
  const value = lookup(text, translation);
  const target = useLocale();
  return value === text ? <>{text}</> : <span lang={target}>{value}</span>;
}

export function RecipeTranslationControls({ compact = false }: { compact?: boolean }) {
  const context = useContext(TranslationContext);
  const t = makeTranslator(useLocale(), messages);
  const id = useId();
  if (!context) return null;
  const { result, original, toggle } = context;
  const canToggle = context.hasCatalogTranslation || Boolean(result.strings?.size);
  let status: string | undefined;
  if (result.status === "downloading") status = t("Downloading language tools… {percent}%", { percent: result.percent ?? 0 });
  else if (!compact && result.status === "working") status = t("Translating on this device…");
  else if (!compact && result.status === "unavailable") status = t(canToggle
    ? "Some text is shown in its original language." : "Showing the original recipe. On-device translation is unavailable.");
  const canRetry = result.canRetry && !compact;
  if (!result.enable && !context.selectSource && !canToggle && !canRetry && !status) return null;
  return (
    <div className="flex flex-wrap items-end gap-2">
      {status && <p className="text-sm text-subtle" role="status">{status}</p>}
      {result.enable && (
        <Button type="button" variant="outline" onClick={result.enable}>
          {t(result.status === "detector" ? "Enable language detection" : "Enable recipe translation")}
        </Button>
      )}
      {context.selectSource && (
        <div className="grid justify-items-start gap-1 text-sm">
          <label htmlFor={id}>{t("Original recipe language")}</label>
          <select id={id} className="site-field min-h-11" defaultValue="" onChange={event => {
            const value = event.currentTarget.value;
            if (isLocale(value)) context.selectSource?.(value);
          }}>
            <option value="" disabled>{t("Choose a language")}</option>
            {Object.entries(languageNames).map(([value, name]) => <option key={value} value={value} lang={value}>{name}</option>)}
          </select>
        </div>
      )}
      {canToggle && (
        <Button type="button" variant="outline" onClick={toggle}>
          {t(original ? "Show translation" : "Show original")}
        </Button>
      )}
      {canRetry && <Button type="button" variant="outline" onClick={context.retry}>{t("Retry translation")}</Button>}
    </div>
  );
}
