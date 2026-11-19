import { useState, useRef, useEffect } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  FileText,
  Layers,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
  User,
  FolderOpen,
  LogOut,
  Database,
  Save,
} from "lucide-react";
import { CompositionRulesDrawer } from "./components/CompositionRulesDrawer";
import { FullScreenTextModal } from "./components/FullScreenTextModal";
import { LoginModal } from "./components/LoginModal";
import { HistoryDrawer } from "./components/HistoryDrawer";
import { ToastContainer } from "./components/ToastContainer";
import { showToast } from "./utils/toast";
import { SlideCard } from "./components/SlideCard";
import { SlideVisualPreview } from "./components/SlideVisualPreview";
import {
  DEFAULT_COMPOSITION_RULES,
  LEGACY_DEFAULT_COMPOSITION_RULES,
  countCustomizedRules,
  type CompositionRules,
} from "./constants/defaultRules";
import {
  GEMINI_MODEL_OPTIONS,
  resolveGeminiModel,
  type GeminiModelId,
} from "./constants/geminiModels";
import { SOURCE_PRESETS } from "./data/presets";
import type { CarouselBlueprint, CarouselSlide } from "./types/carousel";
import { buildLockedImagePrompt } from "./utils/promptBuilder";
import {
  trackGenerateInSheets as trackGenerate,
  saveBlueprintToSheets as saveBlueprint,
  getStoredSession,
  clearStoredSession,
  type UserSession,
  type BlueprintRecord,
} from "./services/googleSheetsApi";

type SlideCountMode = "auto" | "exact";
type OutputView = "cards" | "preview";

const STORAGE_KEY = "bws_carousel_composition_rules_v1";
const MODEL_STORAGE_KEY = "bws_carousel_gemini_model_v1";

function loadStoredModel(): GeminiModelId {
  try {
    return resolveGeminiModel(localStorage.getItem(MODEL_STORAGE_KEY));
  } catch {
    return resolveGeminiModel();
  }
}

function resolveStoredRuleField(
  key: keyof CompositionRules,
  value?: unknown
): string {
  if (typeof value !== "string" || !value.trim()) {
    return DEFAULT_COMPOSITION_RULES[key];
  }
  const legacyDefaults = LEGACY_DEFAULT_COMPOSITION_RULES[key];
  if (
    legacyDefaults &&
    legacyDefaults.some((legacy) => value.trim() === legacy.trim())
  ) {
    return DEFAULT_COMPOSITION_RULES[key];
  }
  return value;
}

function loadStoredRules(): CompositionRules {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_COMPOSITION_RULES };
    const parsed = JSON.parse(raw) as Partial<CompositionRules>;
    return {
      referenceAnchor: resolveStoredRuleField(
        "referenceAnchor",
        parsed.referenceAnchor
      ),
      headerBranding: resolveStoredRuleField("headerBranding", parsed.headerBranding),
      typographyAndMargins: resolveStoredRuleField(
        "typographyAndMargins",
        parsed.typographyAndMargins
      ),
      swipeAndClearance: resolveStoredRuleField(
        "swipeAndClearance",
        parsed.swipeAndClearance
      ),
      illustrationStyle: resolveStoredRuleField(
        "illustrationStyle",
        parsed.illustrationStyle
      ),
      pagingFormat: resolveStoredRuleField("pagingFormat", parsed.pagingFormat),
      officialFooter: resolveStoredRuleField("officialFooter", parsed.officialFooter),
      paletteAndRatio: resolveStoredRuleField(
        "paletteAndRatio",
        parsed.paletteAndRatio
      ),
    };
  } catch {
    return { ...DEFAULT_COMPOSITION_RULES };
  }
}

export default function App() {
  const [session, setSession] = useState<UserSession | null>(() => getStoredSession());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(!getStoredSession());
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  useEffect(() => {
    const handleAuthRequired = () => {
      setIsLoginModalOpen(true);
    };
    const handleSessionUpdated = () => {
      setSession(getStoredSession());
    };
    window.addEventListener("bws_auth_required", handleAuthRequired);
    window.addEventListener("bws_session_updated", handleSessionUpdated);
    return () => {
      window.removeEventListener("bws_auth_required", handleAuthRequired);
      window.removeEventListener("bws_session_updated", handleSessionUpdated);
    };
  }, []);

  // Blueprint database metadata state
  const [activeBlueprintId, setActiveBlueprintId] = useState<string | null>(null);
  const [blueprintTitleInput, setBlueprintTitleInput] = useState("");
  const [blueprintCategory, setBlueprintCategory] = useState<'Regulasi' | 'Pencegahan' | 'Pengawasan' | 'Kegiatan' | 'Edukasi Publik'>('Regulasi');
  const [blueprintStatus, setBlueprintStatus] = useState<'Draft' | 'Siap Desain' | 'Sudah Tayang'>('Draft');
  const [blueprintCreator, setBlueprintCreator] = useState(session?.nama_staf || "Staf Bawaslu");
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const [rawText, setRawText] = useState("");
  const [slideCountMode, setSlideCountMode] = useState<SlideCountMode>("auto");
  const [slideCount, setSlideCount] = useState<number>(8);
  const [selectedModel, setSelectedModel] = useState<GeminiModelId>(() =>
    loadStoredModel()
  );

  const [compositionRules, setCompositionRules] = useState<CompositionRules>(() =>
    loadStoredRules()
  );
  const [isRulesDrawerOpen, setIsRulesDrawerOpen] = useState(false);
  const [isMainModalOpen, setIsMainModalOpen] = useState(false);

  const [blueprint, setBlueprint] = useState<CarouselBlueprint | null>(null);
  const [originalSlides, setOriginalSlides] = useState<Record<string, CarouselSlide>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [outputView, setOutputView] = useState<OutputView>("cards");
  const [previewIndex, setPreviewIndex] = useState(0);
  const [copiedAll, setCopiedAll] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLElement>(null);

  const trimmedLength = rawText.trim().length;
  const wordCount = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;
  const customRulesCount = countCustomizedRules(compositionRules);
  const isCustomRules = customRulesCount > 0;

  function syncBlueprintPromptsWithRules(rules: CompositionRules) {
    setBlueprint((prev) => {
      if (!prev) return prev;
      const total = prev.slides.length;
      return {
        ...prev,
        slides: prev.slides.map((s, idx) => {
          if (s.isManualPrompt || !s.illustration_scene) return s;
          return {
            ...s,
            image_prompt: buildLockedImagePrompt({
              slideIndex: idx,
              totalSlides: total,
              headline: s.headline,
              headlineAccent: s.headline_accent,
              bodyCopy: s.body_copy,
              bodyAccents: s.body_accents,
              illustrationScene: s.illustration_scene,
              rules,
            }),
          };
        }),
      };
    });
  }

  function handleSaveCompositionRules(nextRules: CompositionRules) {
    setCompositionRules(nextRules);
    syncBlueprintPromptsWithRules(nextRules);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRules));
    } catch {
      // Ignore storage quota errors
    }
  }

  function handleResetCompositionRules() {
    const reset = { ...DEFAULT_COMPOSITION_RULES };
    setCompositionRules(reset);
    syncBlueprintPromptsWithRules(reset);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }

  function handleLoadPreset(text: string) {
    setRawText(text);
    setErrorMsg(null);
    textareaRef.current?.focus();
  }

  function handleResetWorkspace() {
    setRawText("");
    setBlueprint(null);
    setOriginalSlides({});
    setErrorMsg(null);
    setOutputView("cards");
    setPreviewIndex(0);
    textareaRef.current?.focus();
  }

  async function handleGenerate(e?: React.FormEvent) {
    if (e) e.preventDefault();

    if (trimmedLength < 20) {
      setErrorMsg(
        "Teks sumber terlalu singkat. Tempelkan minimal 20 karakter artikel berita, siaran pers, atau pasal regulasi."
      );
      textareaRef.current?.focus();
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch("/api/generate-blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          slideCountMode,
          slideCount,
          model: selectedModel,
          compositionRules,
        }),
      });

      const rawResponse = await response.text();
      let data: { title?: string; slides?: Array<Omit<CarouselSlide, "id">>; error?: string } = {};
      if (rawResponse) {
        try {
          data = JSON.parse(rawResponse);
        } catch {
          throw new Error(
            response.ok
              ? "Respons server tidak dalam format JSON yang valid."
              : `Server mengembalikan status ${response.status}. Silakan coba beberapa saat lagi.`
          );
        }
      }

      if (!response.ok) {
        throw new Error(data?.error || `Gagal memproses blueprint carousel (HTTP ${response.status}).`);
      }

      const rawSlides = Array.isArray(data.slides) ? data.slides : [];
      const totalReturned = rawSlides.length;
      const slidesWithIds: CarouselSlide[] = rawSlides.map(
        (s: Omit<CarouselSlide, "id">, idx: number) => ({
          ...s,
          pagination_text: s.pagination_text || `Slide ${idx + 1} dari ${totalReturned}`,
          id: `slide-${Date.now()}-${idx}`,
          isEdited: false,
        })
      );

      const origMap: Record<string, CarouselSlide> = {};
      for (const s of slidesWithIds) {
        origMap[s.id] = { ...s };
      }

      if (session) {
        try {
          const newCount = await trackGenerate(session);
          setSession({ ...session, jumlah_generate: newCount });
        } catch (e) {
          console.error("Failed to track generate", e);
        }
      }

      setActiveBlueprintId(null);
      setBlueprintTitleInput(slidesWithIds[0]?.headline || data.title || "Blueprint Carousel");
      setBlueprintCreator(session?.nama_staf || "Staf Bawaslu");

      setOriginalSlides(origMap);
      setBlueprint({
        title: data.title || "Blueprint Carousel",
        slides: slidesWithIds,
      });
      setOutputView("cards");
      setPreviewIndex(0);

      if (window.innerWidth < 1024) {
        setTimeout(() => {
          outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Terjadi kesalahan saat menghubungi server.";
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleUpdateSlide(id: string, patch: Partial<CarouselSlide>) {
    setBlueprint((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        slides: prev.slides.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      };
    });
  }

  function handleResetSlide(id: string) {
    const orig = originalSlides[id];
    if (!orig) return;
    setBlueprint((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        slides: prev.slides.map((s) =>
          s.id === id ? { ...orig, isEdited: false, isManualPrompt: false } : s
        ),
      };
    });
  }

  async function handleRegenerateSingleSlide(id: string, instruction: string) {
    if (!blueprint) return;
    const slideIndex = blueprint.slides.findIndex((s) => s.id === id);
    if (slideIndex === -1) return;

    const currentSlide = blueprint.slides[slideIndex];
    const response = await fetch("/api/regenerate-slide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawText,
        slideIndex,
        totalSlides: blueprint.slides.length,
        model: selectedModel,
        currentSlide: {
          headline: currentSlide.headline,
          body_copy: currentSlide.body_copy,
          illustration_scene: currentSlide.illustration_scene,
        },
        revisionInstruction: instruction,
        compositionRules,
      }),
    });

    const rawResponse = await response.text();
    let data: { slide?: Omit<CarouselSlide, "id">; error?: string } = {};
    if (rawResponse) {
      try {
        data = JSON.parse(rawResponse);
      } catch {
        throw new Error(
          response.ok
            ? "Respons server tidak valid."
            : `Server mengembalikan status ${response.status}.`
        );
      }
    }

    if (!response.ok || !data.slide) {
      throw new Error(data?.error || "Gagal merevisi slide via AI.");
    }

    const updatedSlide: CarouselSlide = {
      ...data.slide,
      id,
      isEdited: false,
      isManualPrompt: false,
    };

    setOriginalSlides((prev) => ({
      ...prev,
      [id]: { ...updatedSlide },
    }));

    setBlueprint((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        slides: prev.slides.map((s) => (s.id === id ? updatedSlide : s)),
      };
    });
  }

  async function handleCopyAllSlides() {
    if (!blueprint || blueprint.slides.length === 0) return;

    const lines: string[] = [
      `BLUEPRINT CAROUSEL: ${blueprint.title}`,
      `Total Slide: ${blueprint.slides.length}`,
      `========================================`,
      "",
    ];

    const total = blueprint.slides.length;
    for (let i = 0; i < total; i++) {
      const slide = blueprint.slides[i];
      const pageLabel = slide.pagination_text || `Slide ${i + 1} dari ${total}`;
      lines.push(`[${pageLabel}]`);
      lines.push(`Headline: ${slide.headline}`);
      lines.push(`Body Copy: ${slide.body_copy}`);
      lines.push(`Image Prompt: ${slide.image_prompt}`);
      lines.push("");
      lines.push("----------------------------------------");
      lines.push("");
    }

    const fullDraft = lines.join("\n").trim();

    try {
      await navigator.clipboard.writeText(fullDraft);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = fullDraft;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2200);
  }

  function handlePreviewFromCard(index: number) {
    setPreviewIndex(index);
    setOutputView("preview");
  }

  function handleLoadBlueprintFromHistory(record: BlueprintRecord) {
    setActiveBlueprintId(record.id);
    setRawText(record.naskah_sumber || "");
    setSelectedModel(resolveGeminiModel(record.model_ai));
    setBlueprintTitleInput(record.judul_topik);
    setBlueprintCategory(record.kategori);
    setBlueprintStatus(record.status);
    setBlueprintCreator(record.pembuat);

    const bp = record.blueprint_json;
    if (bp && Array.isArray(bp.slides)) {
      const origMap: Record<string, CarouselSlide> = {};
      for (const s of bp.slides) {
        origMap[s.id] = { ...s };
      }
      setOriginalSlides(origMap);
      setBlueprint(bp);
    }
    setOutputView("cards");
    setPreviewIndex(0);
  }

  async function handleSaveBlueprintToDb(isDuplicate = false) {
    if (!blueprint) return;
    setIsSaving(true);
    setSaveToast(null);
    try {
      const targetId = isDuplicate ? null : activeBlueprintId;
      const isUpdate = Boolean(targetId);
      const savedId = await saveBlueprint(session, {
        id: targetId,
        judul_topik: blueprintTitleInput || blueprint.title || "Tanpa Judul",
        kategori: blueprintCategory,
        status: blueprintStatus,
        pembuat: blueprintCreator || session?.nama_staf || "Staf",
        user_email: session?.email || "",
        jumlah_slide: blueprint.slides.length,
        model_ai: selectedModel,
        naskah_sumber: rawText,
        blueprint_json: blueprint,
      });

      setActiveBlueprintId(savedId);
      if (isDuplicate) {
        showToast("Berhasil menduplikat blueprint baru", "success");
        setSaveToast("Berhasil menduplikat blueprint baru");
      } else if (isUpdate) {
        showToast("Perubahan tersimpan", "success");
        setSaveToast("Perubahan tersimpan");
      } else {
        showToast("Blueprint berhasil disimpan", "success");
        setSaveToast("Blueprint berhasil disimpan");
      }
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err: any) {
      showToast("Gagal menyimpan blueprint: " + (err?.message || "Kesalahan jaringan"), "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1C1615] flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="border-b border-[#E6DDD1] bg-[#FDFBF7] sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line brand wordmark */}
          <a
            href="#studio"
            className="font-display text-lg font-bold tracking-tight text-[#1C1615] whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            <span>BWS Carousel Engine</span>
            <span className="text-[10px] bg-[#8B1E24]/10 text-[#8B1E24] px-2 py-0.5 rounded-full font-mono font-semibold">
              Bawaslu Paser
            </span>
          </a>

          {/* Zone 2: Clean single-line navigation links */}
          <nav
            aria-label="Navigasi utama"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-[#5C4F4D]"
          >
            <a
              href="#studio"
              className="hover:text-[#8B1E24] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Workspace
            </a>
            <button
              type="button"
              onClick={() => setIsHistoryDrawerOpen(true)}
              className="hover:text-[#8B1E24] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <FolderOpen className="w-4 h-4 text-[#8B1E24]" />
              <span>Riwayat Tersimpan</span>
            </button>
            <button
              type="button"
              onClick={() => handleLoadPreset(SOURCE_PRESETS[0].text)}
              className="hover:text-[#8B1E24] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Contoh Siaran Pers
            </button>
            <button
              type="button"
              onClick={() => setIsRulesDrawerOpen(true)}
              className="hover:text-[#8B1E24] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Aturan Komposisi
            </button>
          </nav>

          {/* Zone 3: User Session & Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {session && (
              <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-[#FAF6EF] border border-[#E6DDD1] rounded-lg text-xs">
                <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></span>
                <span className="font-medium text-gray-800 truncate max-w-[140px]" title={session.email}>
                  {session.nama_staf || session.email}
                </span>
                <span className="text-gray-400">|</span>
                <span className="font-mono text-[#8B1E24] font-semibold" title="Total generate carousel">
                  {session.jumlah_generate} Gen
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsHistoryDrawerOpen(true)}
              className="md:hidden p-2 text-gray-700 hover:text-[#8B1E24] bg-[#FAF6EF] rounded-lg transition"
              title="Riwayat Tersimpan"
            >
              <FolderOpen className="w-4 h-4" />
            </button>

            {session && (
              <button
                type="button"
                onClick={() => {
                  clearStoredSession();
                  setSession(null);
                  setIsLoginModalOpen(true);
                }}
                className="p-2 text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                title="Keluar / Ganti Akun"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}

            {blueprint ? (
              <button
                type="button"
                onClick={handleResetWorkspace}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1C1615] bg-[#F3ECE1] hover:bg-[#EAE0D0] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Reset Studio</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleLoadPreset(SOURCE_PRESETS[0].text)}
                className="px-4 py-2 text-xs font-semibold text-[#FDFBF7] bg-[#8B1E24] hover:bg-[#72171C] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Muat Contoh Teks
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Two-Column Studio Workspace */}
      <main id="studio" className="flex-1 w-full max-w-[1440px] mx-auto px-6 lg:px-10 py-8">
        {/* Editorial Header */}
        <div className="mb-8 pb-6 border-b border-[#E6DDD1]">
          <p className="text-xs font-medium tracking-wide text-[#8B1E24]">
            Produksi Konten Carousel · Bawaslu Kabupaten Paser
          </p>
          <h1 className="mt-1.5 font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#1C1615] text-balance">
            Ubah Naskah Mentah Menjadi Blueprint Slide Terstruktur
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT PANEL: INPUT */}
          <section
            aria-label="Panel Input Naskah"
            className="lg:col-span-5 lg:sticky lg:top-24 bg-white border border-[#E6DDD1] rounded-xl p-6"
          >
            {/* Composition Rules Bar at Top of Input Panel */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-[#EFE8DE]">
              <div className="flex items-center gap-2 text-xs tabular-nums">
                <span className="text-[#6B5D5A]">Status Konfigurasi:</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded border ${
                    isCustomRules
                      ? "text-[#8B1E24] bg-[#8B1E24]/[0.06] border-[#8B1E24]/25"
                      : "text-[#382F2D] bg-[#FAF6EF] border-[#E6DDD1]"
                  }`}
                >
                  {isCustomRules
                    ? `Aturan: Kustom (${customRulesCount})`
                    : "Aturan: Default"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsRulesDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1C1615] bg-[#FAF6EF] hover:bg-[#F3ECE1] border border-[#DDD2C4] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-[#8B1E24]" aria-hidden="true" />
                <span>Aturan Komposisi</span>
              </button>
            </div>

            <form onSubmit={handleGenerate} className="space-y-5">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label
                    htmlFor="raw-source-text"
                    className="text-sm font-semibold text-[#1C1615]"
                  >
                    Teks Sumber (Berita, Siaran Pers, atau Regulasi)
                  </label>
                  {rawText && (
                    <button
                      type="button"
                      onClick={() => {
                        setRawText("");
                        setErrorMsg(null);
                      }}
                      className="text-xs font-medium text-[#6B5D5A] hover:text-[#8B1E24] transition-colors cursor-pointer"
                    >
                      Bersihkan
                    </button>
                  )}
                </div>

                {/* Sample Preset Quick Loaders */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <span className="text-xs text-[#6B5D5A] mr-1">Contoh cepat:</span>
                  {SOURCE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleLoadPreset(preset.text)}
                      className="px-2.5 py-1 text-xs font-medium text-[#4A3F3D] bg-[#FAF6EF] hover:bg-[#F3ECE1] border border-[#E6DDD1] rounded-md transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <textarea
                  ref={textareaRef}
                  id="raw-source-text"
                  value={rawText}
                  onFocus={(e) => {
                    if (window.innerWidth < 1024) {
                      e.preventDefault();
                      e.target.blur();
                      setIsMainModalOpen(true);
                    }
                  }}
                  onClick={(e) => {
                    if (window.innerWidth < 1024) {
                      e.preventDefault();
                      setIsMainModalOpen(true);
                    }
                  }}
                  onChange={(e) => {
                    setRawText(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Tempelkan artikel berita, draf siaran pers, atau pasal regulasi kepemiluan di sini..."
                  rows={12}
                  className="w-full min-h-[260px] p-4 text-[16px] leading-relaxed text-[#1C1615] placeholder:text-[#9A8C87] bg-[#FDFBF7] border border-[#DDD2C4] rounded-lg focus:outline-none focus:border-[#8B1E24] focus:ring-2 focus:ring-[#8B1E24]/15 resize-y"
                />

                <FullScreenTextModal
                  isOpen={isMainModalOpen}
                  title="Teks Sumber (Berita / Siaran Pers / Regulasi)"
                  initialValue={rawText}
                  placeholder="Tempelkan artikel berita, draf siaran pers, atau pasal regulasi kepemiluan di sini..."
                  onSave={(val) => {
                    setRawText(val);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  onClose={() => setIsMainModalOpen(false)}
                  onClear={() => {
                    setRawText("");
                    setErrorMsg(null);
                  }}
                />

                <div className="mt-2 flex items-center justify-between text-xs text-[#6B5D5A] tabular-nums">
                  <span>{wordCount} kata · {trimmedLength} karakter</span>
                  <span>Rekomendasi: 150–1.500 kata</span>
                </div>
              </div>

              {/* Slide Count Configuration */}
              <div className="pt-4 border-t border-[#EFE8DE]">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-sm font-semibold text-[#1C1615]">
                    Pilihan Jumlah Slide
                  </span>
                  <span className="font-mono text-xs text-[#8B1E24] tabular-nums">
                    {slideCountMode === "auto" ? "Otomatis (4–6+ slide)" : `${slideCount} slide`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F5EFE6] rounded-lg mb-3">
                  <button
                    type="button"
                    onClick={() => setSlideCountMode("auto")}
                    className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      slideCountMode === "auto"
                        ? "bg-white text-[#1C1615] shadow-xs"
                        : "text-[#5C4F4D] hover:text-[#1C1615]"
                    }`}
                  >
                    Otomatis (Sesuai Isi)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlideCountMode("exact")}
                    className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      slideCountMode === "exact"
                        ? "bg-white text-[#1C1615] shadow-xs"
                        : "text-[#5C4F4D] hover:text-[#1C1615]"
                    }`}
                  >
                    Tentukan Jumlah
                  </button>
                </div>

                {slideCountMode === "exact" && (
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FAF6EF] border border-[#E6DDD1] rounded-lg p-3">
                    <div className="flex items-center gap-1.5">
                      {[7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setSlideCount(num)}
                          className={`w-9 h-8 text-xs font-mono font-medium rounded-md transition-colors tabular-nums cursor-pointer ${
                            slideCount === num
                              ? "bg-[#8B1E24] text-[#FDFBF7]"
                              : "bg-white border border-[#DDD2C4] text-[#1C1615] hover:border-[#8B1E24]"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSlideCount((c) => Math.max(1, c - 1))}
                        aria-label="Kurangi jumlah slide"
                        className="w-8 h-8 flex items-center justify-center bg-white border border-[#DDD2C4] rounded-md text-[#1C1615] hover:bg-[#F3ECE1] cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={15}
                        value={slideCount}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (!Number.isNaN(val)) {
                            setSlideCount(Math.min(15, Math.max(1, val)));
                          }
                        }}
                        aria-label="Jumlah slide kustom"
                        className="w-12 h-8 text-center font-mono text-xs font-semibold bg-white border border-[#DDD2C4] rounded-md text-[#1C1615] tabular-nums focus:outline-none focus:border-[#8B1E24]"
                      />
                      <button
                        type="button"
                        onClick={() => setSlideCount((c) => Math.min(15, c + 1))}
                        aria-label="Tambah jumlah slide"
                        className="w-8 h-8 flex items-center justify-center bg-white border border-[#DDD2C4] rounded-md text-[#1C1615] hover:bg-[#F3ECE1] cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Gemini Active Model Selector */}
              <div className="pt-4 border-t border-[#EFE8DE]">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label
                    htmlFor="gemini-model-select"
                    className="text-sm font-semibold text-[#1C1615]"
                  >
                    Model AI Gemini
                  </label>
                  <span className="font-mono text-[11px] text-[#6B5D5A]">
                    {
                      GEMINI_MODEL_OPTIONS.find((m) => m.id === selectedModel)
                        ?.shortLabel
                    }
                  </span>
                </div>
                <div className="relative">
                  <select
                    id="gemini-model-select"
                    value={selectedModel}
                    onChange={(e) => {
                      const next = resolveGeminiModel(e.target.value);
                      setSelectedModel(next);
                      try {
                        localStorage.setItem(MODEL_STORAGE_KEY, next);
                      } catch {
                        // Ignore storage quota errors
                      }
                    }}
                    className="w-full appearance-none pl-3.5 pr-9 py-2.5 text-xs font-medium text-[#1C1615] bg-[#FDFBF7] border border-[#DDD2C4] rounded-lg focus:outline-none focus:border-[#8B1E24] focus:ring-2 focus:ring-[#8B1E24]/15 cursor-pointer"
                  >
                    {GEMINI_MODEL_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="w-4 h-4 text-[#6B5D5A] pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                </div>
              </div>

              {/* Error Banner */}
              {errorMsg && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3.5 text-xs leading-relaxed text-[#8B1E24] bg-[#8B1E24]/[0.06] border border-[#8B1E24]/25 rounded-lg"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Primary CTA */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-5 inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#FDFBF7] bg-[#8B1E24] hover:bg-[#72171C] disabled:opacity-65 disabled:cursor-wait rounded-lg transition-colors cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Menyusun Blueprint Slide...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                    <span>Generate Carousel Blueprint</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* RIGHT PANEL: OUTPUT */}
          <section
            ref={outputRef}
            aria-label="Panel Output Blueprint"
            className="lg:col-span-7 space-y-5"
          >
            {/* Output Header Toolbar */}
            <div className="bg-white border border-[#E6DDD1] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold text-[#1C1615]">
                  {blueprint ? blueprint.title : "Hasil Blueprint Slide"}
                </h2>
                <p className="text-xs text-[#6B5D5A] mt-0.5 tabular-nums">
                  {blueprint
                    ? `${blueprint.slides.length} slide siap salin · Klik teks pada kartu untuk merevisi`
                    : "Belum ada draf yang dibuat"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {blueprint && (
                  <div className="flex items-center p-1 bg-[#F5EFE6] rounded-lg">
                    <button
                      type="button"
                      onClick={() => setOutputView("cards")}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        outputView === "cards"
                          ? "bg-white text-[#1C1615] shadow-xs"
                          : "text-[#5C4F4D] hover:text-[#1C1615]"
                      }`}
                    >
                      Daftar Kartu
                    </button>
                    <button
                      type="button"
                      onClick={() => setOutputView("preview")}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        outputView === "preview"
                          ? "bg-white text-[#1C1615] shadow-xs"
                          : "text-[#5C4F4D] hover:text-[#1C1615]"
                      }`}
                    >
                      Pratinjau 4:5
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCopyAllSlides}
                  disabled={!blueprint || blueprint.slides.length === 0}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:pointer-events-none ${
                    copiedAll
                      ? "bg-[#15803D] text-white"
                      : "bg-[#8B1E24] text-[#FDFBF7] hover:bg-[#72171C]"
                  }`}
                >
                  {copiedAll ? (
                    <>
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Semua Slide Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Copy All Slides</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Output States: Loading / Empty / Populated */}
            {blueprint && !isLoading && (
              <div className="mb-6 bg-white border border-[#E6DDD1] rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#8B1E24]"></span>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                      Metadata Blueprint {activeBlueprintId ? `(Tersimpan: ${activeBlueprintId})` : "(Belum Disimpan)"}
                    </h3>
                  </div>
                  {saveToast && (
                    <div className="px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-lg border border-green-200 flex items-center gap-1.5 animate-in fade-in">
                      <Check className="w-3.5 h-3.5" />
                      <span>{saveToast}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                      Judul Topik
                    </label>
                    <input
                      type="text"
                      value={blueprintTitleInput}
                      onChange={(e) => setBlueprintTitleInput(e.target.value)}
                      placeholder="Judul topik carousel..."
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8B1E24]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                      Kategori
                    </label>
                    <select
                      value={blueprintCategory}
                      onChange={(e) => setBlueprintCategory(e.target.value as any)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8B1E24]"
                    >
                      <option value="Regulasi">Regulasi</option>
                      <option value="Pencegahan">Pencegahan</option>
                      <option value="Pengawasan">Pengawasan</option>
                      <option value="Kegiatan">Kegiatan</option>
                      <option value="Edukasi Publik">Edukasi Publik</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                      Status
                    </label>
                    <select
                      value={blueprintStatus}
                      onChange={(e) => setBlueprintStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8B1E24]"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Siap Desain">Siap Desain</option>
                      <option value="Sudah Tayang">Sudah Tayang</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                      Pembuat
                    </label>
                    <input
                      type="text"
                      value={blueprintCreator}
                      onChange={(e) => setBlueprintCreator(e.target.value)}
                      placeholder="Nama staf..."
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8B1E24]"
                    />
                  </div>
                </div>

                {/* Save Buttons */}
                <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-gray-100">
                  {activeBlueprintId === null ? (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveBlueprintToDb(false)}
                      className="px-4 py-2.5 bg-[#8B1E24] hover:bg-[#72171C] text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSaving ? "Menyimpan..." : "Simpan ke Database"}</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSaveBlueprintToDb(false)}
                        className="px-4 py-2.5 bg-[#8B1E24] hover:bg-[#72171C] text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        <span>{isSaving ? "Menyimpan..." : "Simpan Perubahan (Update)"}</span>
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSaveBlueprintToDb(true)}
                        className="px-4 py-2.5 bg-[#F3ECE1] hover:bg-[#EAE0D0] text-[#1C1615] text-xs font-semibold rounded-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Copy className="w-4 h-4" />
                        <span>Duplikat Sebagai Baru</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="space-y-4" aria-busy="true" aria-label="Memuat blueprint slide">
                {Array.from({ length: slideCountMode === "exact" ? Math.min(slideCount, 4) : 4 }).map(
                  (_, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-[#E6DDD1] rounded-xl p-6 animate-pulse"
                    >
                      <div className="flex items-center justify-between pb-4 border-b border-[#EFE8DE]">
                        <div className="h-4 w-36 bg-[#EFE8DE] rounded" />
                        <div className="h-7 w-20 bg-[#EFE8DE] rounded-md" />
                      </div>
                      <div className="pt-4 space-y-2.5">
                        <div className="h-5 w-3/4 bg-[#EFE8DE] rounded" />
                        <div className="h-4 w-full bg-[#F5EFE6] rounded" />
                        <div className="h-4 w-5/6 bg-[#F5EFE6] rounded" />
                      </div>
                      <div className="mt-5 pt-4 border-t border-[#EFE8DE]">
                        <div className="h-20 w-full bg-[#FAF6EF] rounded-lg" />
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : !blueprint ? (
              <div className="bg-white border border-[#E6DDD1] rounded-xl p-8 sm:p-10">
                <div className="max-w-lg">
                  <div className="w-10 h-10 rounded-lg bg-[#8B1E24]/10 text-[#8B1E24] flex items-center justify-center mb-4">
                    <Layers className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#1C1615]">
                    Siap Menyusun Blueprint Carousel
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5C4F4D]">
                    Tempelkan teks mentah di panel kiri lalu tekan{" "}
                    <strong className="font-semibold text-[#1C1615]">
                      Generate Carousel Blueprint
                    </strong>
                    . Sistem akan memecah materi menjadi slide berurutan lengkap dengan pratinjau headline, body copy, dan prompt ilustrasi sesuai aturan komposisi aktif.
                  </p>

                  <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-[#EFE8DE] text-xs">
                    <div>
                      <dt className="font-semibold text-[#8B1E24]">1. Headline 4–6 Kata</dt>
                      <dd className="mt-1 text-[#5C4F4D] leading-relaxed">
                        Ringkas dan punchy (skala 12.5pt, maks. 75% lebar kanvas) agar tata letak atas tetap lapang.
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[#8B1E24]">2. Body Copy 18–24 Kata</dt>
                      <dd className="mt-1 text-[#5C4F4D] leading-relaxed">
                        Maksimal 2–3 baris pendek (skala 10pt) yang nyaman dibaca dengan ruang kosong aman min. 40px di bawahnya.
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[#8B1E24]">3. Prompt Terkunci &amp; Fleksibel</dt>
                      <dd className="mt-1 text-[#5C4F4D] leading-relaxed">
                        Menggunakan pakem standar Bawaslu Paser secara default, dan dapat disesuaikan kapan saja lewat Aturan Komposisi.
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[#8B1E24]">4. Paging Kapsul &amp; Footer Resmi</dt>
                      <dd className="mt-1 text-[#5C4F4D] leading-relaxed">
                        Kapsul marun &ldquo;Slide [Nomor] dari [Total]&rdquo; di kanan bawah serta footer 5 kanal resmi tanpa balon kata.
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-6 pt-5 border-t border-[#EFE8DE] flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleLoadPreset(SOURCE_PRESETS[0].text)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#8B1E24] bg-[#FAF6EF] hover:bg-[#F3ECE1] border border-[#DDD2C4] rounded-lg transition-colors cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Muat Contoh Siaran Pers Bawaslu</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsRulesDrawerOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#1C1615] bg-white hover:bg-[#FAF6EF] border border-[#DDD2C4] rounded-lg transition-colors cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5 text-[#8B1E24]" aria-hidden="true" />
                      <span>Sesuaikan Aturan Komposisi</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : outputView === "preview" ? (
              <SlideVisualPreview
                slides={blueprint.slides}
                activeIndex={previewIndex}
                onChangeIndex={setPreviewIndex}
                onEditInList={() => setOutputView("cards")}
              />
            ) : (
              <div className="space-y-4">
                {blueprint.slides.map((slide, index) => (
                  <SlideCard
                    key={slide.id}
                    slide={slide}
                    originalSlide={originalSlides[slide.id]}
                    compositionRules={compositionRules}
                    index={index}
                    totalSlides={blueprint.slides.length}
                    onUpdate={handleUpdateSlide}
                    onResetSlide={handleResetSlide}
                    onRegenerateSlide={handleRegenerateSingleSlide}
                    onPreviewSlide={handlePreviewFromCard}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Composition Rules Editable Slide-Over Drawer */}
      <CompositionRulesDrawer
        isOpen={isRulesDrawerOpen}
        onClose={() => setIsRulesDrawerOpen(false)}
        rules={compositionRules}
        onSaveRules={handleSaveCompositionRules}
        onResetAll={handleResetCompositionRules}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        savedSession={session}
        onLoginSuccess={(newSession) => {
          setSession(newSession);
          setIsLoginModalOpen(false);
          setBlueprintCreator(newSession.nama_staf);
        }}
      />

      <HistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        currentUserEmail={session?.email || ""}
        onLoadBlueprint={handleLoadBlueprintFromHistory}
      />

      <ToastContainer />
    </div>
  );
}
