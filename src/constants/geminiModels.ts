export const GEMINI_MODEL_OPTIONS = [
  {
    id: "gemini-3.1-flash-lite",
    label: "gemini-3.1-flash-lite (Utama - Cepat & Akurat)",
    shortLabel: "Cepat & Akurat",
  },
  {
    id: "gemini-4-hydrogen",
    label: "gemini-4-hydrogen (Alternatif - Analisis Mendalam)",
    shortLabel: "Analisis Mendalam",
  },
] as const;

export type GeminiModelId = (typeof GEMINI_MODEL_OPTIONS)[number]["id"];

export const DEFAULT_GEMINI_MODEL: GeminiModelId = "gemini-3.1-flash-lite";

export function resolveGeminiModel(candidate?: unknown): GeminiModelId {
  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    if (trimmed === "gemini-2.5-flash-lite") return "gemini-3.1-flash-lite";
    if (trimmed === "gemini-2.5-flash") return "gemini-4-hydrogen";
    const matched = GEMINI_MODEL_OPTIONS.find((item) => item.id === trimmed);
    if (matched) return matched.id;
  }
  return DEFAULT_GEMINI_MODEL;
}
