export type TranslatorApi = {
  availability: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<string>;
  create: (options: {
    sourceLanguage: string;
    targetLanguage: string;
    signal?: AbortSignal;
  }) => Promise<{ translate: (text: string) => Promise<string>; destroy: () => void }>;
};
export type DetectorApi = {
  availability: () => Promise<string>;
  create: (options?: { signal?: AbortSignal }) => Promise<{
    detect: (text: string) => Promise<{ detectedLanguage: string; confidence: number }[]>;
    destroy: () => void;
  }>;
};
export type TranslationPlatform = { Translator?: TranslatorApi; LanguageDetector?: DetectorApi };
export async function translateLocally(
  text: string,
  locale: string,
  signal: AbortSignal,
  platform: TranslationPlatform = globalThis as TranslationPlatform,
) {
  const { Translator, LanguageDetector } = platform;
  if (!Translator || !LanguageDetector) throw new Error("TRANSLATION_UNAVAILABLE");
  let detector: Awaited<ReturnType<DetectorApi["create"]>> | undefined;
  let translator: Awaited<ReturnType<TranslatorApi["create"]>> | undefined;
  try {
    signal.throwIfAborted();
    if ((await LanguageDetector.availability()) === "unavailable")
      throw new Error("TRANSLATION_UNAVAILABLE");
    detector = await LanguageDetector.create({ signal });
    signal.throwIfAborted();
    const [detected] = await detector.detect(text);
    signal.throwIfAborted();
    if (!detected || detected.detectedLanguage === "und" || detected.confidence < 0.5)
      throw new Error("TRANSLATION_UNCERTAIN");
    const sourceLanguage = detected.detectedLanguage;
    const targetLanguage = locale.split("-")[0] || "fr";
    if (sourceLanguage.split("-")[0] === targetLanguage)
      throw new Error("TRANSLATION_SAME_LANGUAGE");
    const options = { sourceLanguage, targetLanguage };
    if ((await Translator.availability(options)) === "unavailable")
      throw new Error("TRANSLATION_UNAVAILABLE");
    translator = await Translator.create({ ...options, signal });
    signal.throwIfAborted();
    const translated = await translator.translate(text);
    signal.throwIfAborted();
    return { text: translated, sourceLanguage, targetLanguage };
  } finally {
    translator?.destroy();
    detector?.destroy();
  }
}
