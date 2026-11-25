import type { Locale } from "@/lib/i18n";

type Availability = "unavailable" | "downloadable" | "downloading" | "available";
type Detection = { detectedLanguage: string; confidence: number };
type Detector = { detect(text: string, options: { signal: AbortSignal }): Promise<Detection[]>; destroy(): void };
type Translator = { translate(text: string, options: { signal: AbortSignal }): Promise<string>; destroy(): void };
type Pair = { sourceLanguage: string; targetLanguage: Locale };

export type BrowserLanguageTools = {
  LanguageDetector?: {
    availability(): Promise<Availability>;
    create(options: { signal: AbortSignal }): Promise<Detector>;
  };
  Translator?: {
    availability(pair: Pair): Promise<Availability>;
    create(options: Pair & { signal: AbortSignal }): Promise<Translator>;
  };
};

export type BeginDownload = <T>(model: "detector" | "translator", create: () => Promise<T>, modelId: string) => Promise<T>;
export type TranslationResult = { strings: Map<string, string>; needsSource: boolean };

async function openModel<T>(
  availability: Availability, model: "detector" | "translator", create: () => Promise<T>, beginDownload: BeginDownload, modelId: string,
) {
  if (availability === "unavailable") return null;
  if (availability === "available") {
    try {
      return await create();
    } catch (error) {
      // Some browser versions require a gesture even for an installed model.
      if (!(error instanceof DOMException && error.name === "NotAllowedError")) throw error;
    }
  }
  return beginDownload(model, create, modelId);
}

function language(detection?: Detection): string | undefined {
  if (!detection || detection.confidence < 0.6 || detection.detectedLanguage === "und") return;
  const tag = detection.detectedLanguage.toLowerCase();
  if (/^zh-(hant|tw|hk|mo)\b/.test(tag)) return "zh-Hant";
  return tag.split("-")[0];
}

// Chrome can install a translation pair even when its separate detector is unavailable.
// Use common language-specific cooking words for this fallback. Leave ambiguous Latin text alone.
const frenchWords = new Set(("les des du au aux avec dans puis une sur pour jusqu pendant bien " +
  "œuf œufs oeuf oeufs bol recette ingrédients beurre farine lait huile ail oignon oignons soupe " +
  "mélanger mélangez ajouter ajoutez faites faire cuire cuisson chauffer battez battre fouetter " +
  "verser versez couper coupez émincer minutes environ casserole chauffer préchauffer servir").split(" "));
const englishWords = new Set(("the and with into until then for to of in from your this about " +
  "egg eggs bowl recipe ingredients butter flour milk sugar garlic onion onions soup pancakes " +
  "mix stir whisk beat add pour cook cooking simmer bake preheat chop chopped serve serving " +
  "tablespoon teaspoon large small heat hot pan oven gently together combine").split(" "));

function likelyLanguage(text: string): string | undefined {
  if (/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Arabic}]/u.test(text)) return "other";
  const han = text.match(/\p{Script=Han}/gu)?.length ?? 0;
  const words = new Set(text.toLowerCase().match(/\p{L}+/gu));
  let french = 0, english = 0;
  for (const word of words) {
    if (frenchWords.has(word)) french++;
    if (englishWords.has(word)) english++;
  }
  if (han > 0 && han >= 3 * Math.max(english, french)) return "zh";
  if (french >= 2 && french > english) return "fr";
  if (english >= 2 && english > french) return "en";
}

// All models and results live only for this view. Cook-authored strings never leave the browser.
export async function translateRecipe(
  browser: BrowserLanguageTools, texts: readonly string[], target: Locale, signal: AbortSignal, beginDownload: BeginDownload,
  fallbackSource?: Locale, onTranslatedPair?: (strings: ReadonlyMap<string, string>) => void,
): Promise<TranslationResult | null> {
  const { LanguageDetector, Translator } = browser;
  signal.throwIfAborted();
  if (!Translator) return null;

  const entries = [...new Set(texts.filter(text => /\p{L}/u.test(text)))];
  const translated = new Map<string, string>();
  if (!entries.length) return { strings: translated, needsSource: false };

  let detector: Detector | null = null;
  const sample = entries.map(text => text.slice(0, 400)).join("\n").slice(0, 1800);
  const inferred = likelyLanguage(sample);
  if (LanguageDetector) {
    try {
      const availability = await LanguageDetector.availability();
      // Skip an optional detector download when the recipe language is already clear.
      if (availability === "available" || (!inferred && !fallbackSource)) {
        detector = await openModel(availability, "detector", () => LanguageDetector.create({ signal }), beginDownload, "detector");
      }
    } catch {
      signal.throwIfAborted();
    }
  }
  async function detect(text: string) {
    if (detector) {
      try {
        const detected = language((await detector.detect(text, { signal }))[0]);
        if (detected) return detected;
      } catch {
        signal.throwIfAborted();
      }
    }
    return likelyLanguage(text);
  }
  const groups = new Map<string, string[]>();
  let needsSource = false;
  try {
    // Short titles and ingredient notes often need the context of the surrounding recipe.
    const context = fallbackSource ?? await detect(sample);
    for (const text of entries) {
      signal.throwIfAborted();
      const source = await detect(text.slice(0, 1500)) ?? context;
      if (!source) {
        needsSource = true;
        continue;
      }
      if (!["en", "fr", "zh", "zh-Hant"].includes(source) || source.split("-")[0] === target) continue;
      const existing = groups.get(source);
      if (existing) existing.push(text);
      else groups.set(source, [text]);
    }
  } finally {
    detector?.destroy();
  }

  let completed = false;
  for (const [sourceLanguage, strings] of groups) {
    signal.throwIfAborted();
    const pair = { sourceLanguage, targetLanguage: target };
    const translator = await openModel(await Translator.availability(pair), "translator",
      () => Translator.create({ ...pair, signal }), beginDownload, sourceLanguage + ":" + target);
    if (!translator) continue;

    try {
      for (const text of strings) {
        signal.throwIfAborted();
        try {
          const result = await translator.translate(text, { signal });
          if (result.trim()) {
            completed = true;
            if (result !== text) translated.set(text, result);
          }
        } catch {
          // A field can exceed the model's input limit; continue with the other fields.
          signal.throwIfAborted();
        }
      }
    } finally {
      translator.destroy();
    }
    if (translated.size) onTranslatedPair?.(translated);
  }
  return groups.size && !completed ? null : { strings: translated, needsSource };
}
