import { describe, expect, it, vi } from "vitest";
import { translateRecipe, type BrowserLanguageTools, type BeginDownload } from "@/lib/i18n/on-device";

const signal = new AbortController().signal;
const noDownload: BeginDownload = () => { throw new Error("Unexpected download"); };

function installedTranslator() {
  const translate = vi.fn(async (text: string) => "译：" + text);
  const destroy = vi.fn();
  const create = vi.fn(async () => ({ translate, destroy }));
  const Translator: BrowserLanguageTools["Translator"] = { availability: async () => "available", create };
  return { Translator, create, translate, destroy };
}

describe("on-device recipe translation", () => {
  it("translates and deduplicates recipe fields using an installed pair when detection is unavailable", async () => {
    const { Translator, translate, create, destroy } = installedTranslator();
    const fields = ["Bowl", "Beat eggs in a large bowl.", "Bowl"];
    const result = await translateRecipe({ Translator }, fields, "fr", signal, noDownload);
    expect([...result!.strings.keys()]).toEqual(["Bowl", "Beat eggs in a large bowl."]);
    expect(create).toHaveBeenCalledWith({ sourceLanguage: "en", targetLanguage: "fr", signal });
    expect(translate).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("handles mixed French and Chinese fields and preserves text outside the supported languages", async () => {
    const { Translator, create } = installedTranslator();
    const fields = ["在碗里打散鸡蛋。", "Battez les œufs dans un bol.", "Добавьте молоко."];
    const progress: string[][] = [];
    const result = await translateRecipe({ Translator }, fields, "en", signal, noDownload, undefined,
      strings => progress.push([...strings.keys()]));
    expect(progress).toEqual([fields.slice(0, 1), fields.slice(0, 2)]);
    expect([...result!.strings.keys()]).toEqual(fields.slice(0, 2));
    expect(create).toHaveBeenCalledWith({ sourceLanguage: "zh", targetLanguage: "en", signal });
    expect(create).toHaveBeenCalledWith({ sourceLanguage: "fr", targetLanguage: "en", signal });
  });

  it("uses native detection for traditional Chinese and waits for activation to install a language pack", async () => {
    const { create } = installedTranslator();
    const detector = { detect: vi.fn(async () => [{ detectedLanguage: "zh-Hant-TW", confidence: 0.99 }]), destroy: vi.fn() };
    const browser: BrowserLanguageTools = {
      LanguageDetector: { availability: async () => "available", create: async () => detector },
      Translator: { availability: async () => "downloadable", create },
    };
    const begin: BeginDownload = async (model, start) => {
      expect(model).toBe("translator");
      expect(create).not.toHaveBeenCalled();
      return start();
    };
    expect((await translateRecipe(browser, ["攪拌均勻"], "fr", signal, begin))?.strings.size).toBe(1);
    expect(create).toHaveBeenCalledWith({ sourceLanguage: "zh-Hant", targetLanguage: "fr", signal });
    expect(detector.destroy).toHaveBeenCalledOnce();
  });

  it("returns originals without downloads on an unsupported device or an unknown source language", async () => {
    expect(await translateRecipe({}, ["Add the milk"], "fr", signal, noDownload)).toBeNull();
    const { Translator, create } = installedTranslator();
    expect((await translateRecipe({ Translator }, ["Velouté"], "en", signal, noDownload))?.needsSource).toBe(true);
    expect(create).not.toHaveBeenCalled();
    const manual = await translateRecipe({ Translator }, ["Velouté"], "en", signal, noDownload, "fr");
    expect(manual?.strings.get("Velouté")).toBe("译：Velouté");
    expect(manual?.needsSource).toBe(false);
  });

  it("uses the recipe language for short labels and honors an explicit source", async () => {
    const { Translator, create } = installedTranslator();
    const detect = vi.fn(async (text: string) => [{ detectedLanguage: text === "Roux" ? "fr" : "en", confidence: 0.98 }]);
    const LanguageDetector: BrowserLanguageTools["LanguageDetector"] = {
      availability: async () => "available", create: async () => ({ detect, destroy: vi.fn() }),
    };
    const fields = ["Roux", "Warm the milk and whisk in the butter."];
    const result = await translateRecipe({ LanguageDetector, Translator }, fields, "fr", signal, noDownload);
    expect(result?.strings.get("Roux")).toBe("译：Roux");
    expect(detect).not.toHaveBeenCalledWith("Roux", { signal });
    detect.mockClear();
    await translateRecipe({ LanguageDetector, Translator }, ["Mélange maison"], "en", signal, noDownload, "fr");
    expect(detect).not.toHaveBeenCalled();
    expect(create).toHaveBeenLastCalledWith({ sourceLanguage: "fr", targetLanguage: "en", signal });
  });

  it("continues with other languages and reports partial translations after a download fails", async () => {
    const { create } = installedTranslator();
    const result = await translateRecipe({ Translator: {
      availability: async () => "available",
      create: options => options.sourceLanguage === "zh" ? Promise.reject(new Error("Download failed")) : create(),
    } }, ["打散鸡蛋。", "Battez les œufs dans un bol."], "en", signal, noDownload);
    expect([...result!.strings.keys()]).toEqual(["Battez les œufs dans un bol."]);
    expect(result?.incomplete).toBe(true);
    expect(result?.canRetry).toBe(true);
  });

  it("completes catalog-only recipes without native APIs", async () => {
    expect(await translateRecipe({}, [], "zh", signal, noDownload)).toEqual({
      strings: new Map(), needsSource: false, incomplete: false, canRetry: false,
    });
  });
});
