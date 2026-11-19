import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Loader2,
  Maximize2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { CompositionRules } from "../constants/defaultRules";
import type { CarouselSlide } from "../types/carousel";
import { buildLockedImagePrompt } from "../utils/promptBuilder";
import { FullScreenTextModal } from "./FullScreenTextModal";

interface SlideCardProps {
  slide: CarouselSlide;
  originalSlide?: CarouselSlide;
  compositionRules: CompositionRules;
  onUpdate: (id: string, patch: Partial<CarouselSlide>) => void;
  onResetSlide: (id: string) => void;
  onRegenerateSlide: (id: string, instruction: string) => Promise<void>;
  onPreviewSlide?: (index: number) => void;
  index: number;
  totalSlides: number;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function SlideCard({
  slide,
  originalSlide,
  compositionRules,
  onUpdate,
  onResetSlide,
  onRegenerateSlide,
  onPreviewSlide,
  index,
  totalSlides,
}: SlideCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [revisionInput, setRevisionInput] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedSlideText, setCopiedSlideText] = useState(false);
  const [modalField, setModalField] = useState<"headline" | "body" | "prompt" | null>(
    null
  );
  const [showBottomFade, setShowBottomFade] = useState(false);
  const promptScrollRef = useRef<HTMLDivElement>(null);

  const updateScrollFade = useCallback(() => {
    const el = promptScrollRef.current;
    if (!el) {
      setShowBottomFade(false);
      return;
    }
    const hasOverflow = el.scrollHeight > el.clientHeight + 2;
    const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    setShowBottomFade(hasOverflow && !isAtBottom);
  }, []);

  useEffect(() => {
    updateScrollFade();
    const el = promptScrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => updateScrollFade());
    observer.observe(el);
    return () => observer.disconnect();
  }, [slide.image_prompt, updateScrollFade]);

  const pageIndicator =
    slide.pagination_text || `Slide ${index + 1} dari ${totalSlides}`;
  const headlineWords = countWords(slide.headline);
  const bodyWords = countWords(slide.body_copy);

  const hasChanges =
    originalSlide &&
    (slide.headline !== originalSlide.headline ||
      slide.body_copy !== originalSlide.body_copy ||
      slide.image_prompt !== originalSlide.image_prompt);

  function computeSyncedPrompt(nextHeadline: string, nextBody: string): string {
    if (!slide.isManualPrompt && slide.illustration_scene) {
      return buildLockedImagePrompt({
        slideIndex: index,
        totalSlides,
        headline: nextHeadline,
        headlineAccent: slide.headline_accent,
        bodyCopy: nextBody,
        bodyAccents: slide.body_accents,
        illustrationScene: slide.illustration_scene,
        rules: compositionRules,
      });
    }

    let nextPrompt = slide.image_prompt;
    if (slide.headline && nextHeadline !== slide.headline && nextPrompt.includes(slide.headline)) {
      nextPrompt = nextPrompt.replace(slide.headline, nextHeadline);
    }
    if (slide.body_copy && nextBody !== slide.body_copy && nextPrompt.includes(slide.body_copy)) {
      nextPrompt = nextPrompt.replace(slide.body_copy, nextBody);
    }
    return nextPrompt;
  }

  function handleHeadlineChange(nextHeadline: string) {
    onUpdate(slide.id, {
      headline: nextHeadline,
      image_prompt: computeSyncedPrompt(nextHeadline, slide.body_copy),
      isEdited: true,
    });
  }

  function handleBodyChange(nextBody: string) {
    onUpdate(slide.id, {
      body_copy: nextBody,
      image_prompt: computeSyncedPrompt(slide.headline, nextBody),
      isEdited: true,
    });
  }

  function handleResyncPrompt() {
    if (!slide.illustration_scene) return;
    onUpdate(slide.id, {
      isManualPrompt: false,
      image_prompt: buildLockedImagePrompt({
        slideIndex: index,
        totalSlides,
        headline: slide.headline,
        headlineAccent: slide.headline_accent,
        bodyCopy: slide.body_copy,
        bodyAccents: slide.body_accents,
        illustrationScene: slide.illustration_scene,
        rules: compositionRules,
      }),
    });
  }

  async function handleSubmitRegenerate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (isRegenerating) return;

    setIsRegenerating(true);
    setRegenError(null);
    try {
      await onRegenerateSlide(slide.id, revisionInput.trim());
      setIsRevising(false);
      setRevisionInput("");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Gagal merevisi slide via AI.";
      setRegenError(msg);
    } finally {
      setIsRegenerating(false);
    }
  }

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(slide.image_prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = slide.image_prompt;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  }

  async function handleCopyTextOnly() {
    const formatted = `${pageIndicator}\nHeadline: ${slide.headline}\nBody Copy: ${slide.body_copy}`;
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedSlideText(true);
      setTimeout(() => setCopiedSlideText(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = formatted;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedSlideText(true);
      setTimeout(() => setCopiedSlideText(false), 2000);
    }
  }

  return (
    <article
      className="bg-white border border-[#E6DDD1] rounded-xl p-6 transition-colors duration-150 hover:border-[#D4C5B4]"
      aria-label={pageIndicator}
    >
      {/* Top Meta & Explicit Page Indicator Row */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#EFE8DE]">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B5D5A] tabular-nums">
          <span className={headlineWords > 6 ? "text-[#B45309] font-medium" : ""}>
            Headline {headlineWords}/6 kata
          </span>
          <span aria-hidden="true">·</span>
          <span className={bodyWords > 24 ? "text-[#B45309] font-medium" : ""}>
            Body {bodyWords}/24 kata
          </span>
          {index === 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#8B1E24] font-medium">Lencana SWIPE &lt;&lt;&lt;</span>
            </>
          )}
          {hasChanges && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#8B1E24] font-medium">Diedit</span>
            </>
          )}
        </div>

        {/* Explicit Page Indicator in Top-Right Corner */}
        <span
          className="font-mono font-semibold text-[13px] text-[#8B1E24] tabular-nums whitespace-nowrap shrink-0"
          aria-label={`Halaman ${pageIndicator}`}
        >
          {pageIndicator}
        </span>
      </div>

      {/* Card Action Controls */}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-3">
        {onPreviewSlide && (
          <button
            type="button"
            onClick={() => onPreviewSlide(index)}
            className="px-2.5 py-1.5 text-xs font-medium text-[#5C4F4D] hover:text-[#1C1615] hover:bg-[#F7F2EA] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Lihat 4:5
          </button>
        )}

        <button
          type="button"
          onClick={handleCopyTextOnly}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#5C4F4D] hover:text-[#1C1615] hover:bg-[#F7F2EA] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title="Salin nomor halaman, Headline & Body Copy"
        >
          {copiedSlideText ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
              <span className="text-[#15803D]">Teks Tersalin</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Salin Teks</span>
            </>
          )}
        </button>

        {hasChanges && (
          <button
            type="button"
            onClick={() => onResetSlide(slide.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#6B5D5A] hover:text-[#8B1E24] hover:bg-[#F7F2EA] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Kembalikan teks asli dari AI"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setIsRevising((prev) => !prev);
            setRegenError(null);
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            isRevising
              ? "bg-[#F3ECE1] text-[#8B1E24] border border-[#8B1E24]/30"
              : "border border-[#DDD2C4] text-[#4A3F3D] bg-[#FAF6EF] hover:bg-[#F3ECE1] hover:text-[#1C1615]"
          }`}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          <span>Revisi Slide</span>
        </button>

        <button
          type="button"
          onClick={() => setIsEditing((prev) => !prev)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            isEditing
              ? "bg-[#8B1E24] text-[#FDFBF7] hover:bg-[#72171C]"
              : "border border-[#DDD2C4] text-[#1C1615] bg-[#FDFBF7] hover:bg-[#F3ECE1]"
          }`}
        >
          {isEditing ? (
            <>
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Selesai Edit</span>
            </>
          ) : (
            <>
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Edit Teks</span>
            </>
          )}
        </button>
      </div>

      {/* Optional Single-Slide AI Revision Panel */}
      {isRevising && (
        <form
          onSubmit={handleSubmitRegenerate}
          className="mt-3 p-3.5 bg-[#FAF6EF] border border-[#E6DDD1] rounded-lg space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={`revise-${slide.id}`}
              className="text-xs font-semibold text-[#1C1615]"
            >
              Revisi Slide Ini via AI (tanpa mengubah slide lain)
            </label>
            <button
              type="button"
              onClick={() => {
                setIsRevising(false);
                setRegenError(null);
              }}
              className="text-xs text-[#6B5D5A] hover:text-[#1C1615] cursor-pointer"
            >
              Batal
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id={`revise-${slide.id}`}
              type="text"
              value={revisionInput}
              onChange={(e) => setRevisionInput(e.target.value)}
              disabled={isRegenerating}
              placeholder="Arahan opsional (misal: ganti ilustrasi jadi diskusi di kantor desa)"
              className="flex-1 px-3 py-2 text-xs text-[#1C1615] placeholder:text-[#9A8C87] bg-white border border-[#DDD2C4] rounded-md focus:outline-none focus:border-[#8B1E24] focus:ring-2 focus:ring-[#8B1E24]/15 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isRegenerating}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#FDFBF7] bg-[#8B1E24] hover:bg-[#72171C] disabled:opacity-65 disabled:cursor-wait rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  <span>Merevisi...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Regenerate Slide Ini</span>
                </>
              )}
            </button>
          </div>

          {regenError && (
            <div
              role="alert"
              className="flex items-start gap-2 text-xs text-[#8B1E24] pt-1"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{regenError}</span>
            </div>
          )}
        </form>
      )}

      {/* Headline & Body Copy Preview / Inline Editor */}
      <div className="pt-4">
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor={`headline-${slide.id}`}
                  className="text-xs font-medium text-[#4A3F3D]"
                >
                  Headline (maks. 4–6 kata · otomatis sinkron ke prompt)
                </label>
                <span
                  className={`text-xs font-mono tabular-nums ${
                    headlineWords > 6 ? "text-[#B45309]" : "text-[#6B5D5A]"
                  }`}
                >
                  {headlineWords}/6 kata
                </span>
              </div>
              <input
                id={`headline-${slide.id}`}
                type="text"
                value={slide.headline}
                onFocus={(e) => {
                  if (window.innerWidth < 1024) {
                    e.preventDefault();
                    e.target.blur();
                    setModalField("headline");
                  }
                }}
                onClick={(e) => {
                  if (window.innerWidth < 1024) {
                    e.preventDefault();
                    setModalField("headline");
                  }
                }}
                onChange={(e) => handleHeadlineChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-[16px] font-display font-semibold text-[#1C1615] bg-[#FDFBF7] border border-[#D4C5B4] rounded-lg focus:outline-none focus:border-[#8B1E24] focus:ring-2 focus:ring-[#8B1E24]/15"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor={`body-${slide.id}`}
                  className="text-xs font-medium text-[#4A3F3D]"
                >
                  Body Copy (maks. 18–24 kata · otomatis sinkron ke prompt)
                </label>
                <span
                  className={`text-xs font-mono tabular-nums ${
                    bodyWords > 24 ? "text-[#B45309]" : "text-[#6B5D5A]"
                  }`}
                >
                  {bodyWords}/24 kata
                </span>
              </div>
              <textarea
                id={`body-${slide.id}`}
                rows={3}
                value={slide.body_copy}
                onFocus={(e) => {
                  if (window.innerWidth < 1024) {
                    e.preventDefault();
                    e.target.blur();
                    setModalField("body");
                  }
                }}
                onClick={(e) => {
                  if (window.innerWidth < 1024) {
                    e.preventDefault();
                    setModalField("body");
                  }
                }}
                onChange={(e) => handleBodyChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-[16px] leading-relaxed text-[#1C1615] bg-[#FDFBF7] border border-[#D4C5B4] rounded-lg focus:outline-none focus:border-[#8B1E24] focus:ring-2 focus:ring-[#8B1E24]/15 resize-y"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor={`prompt-${slide.id}`}
                  className="text-xs font-medium text-[#4A3F3D]"
                >
                  Unified Image Prompt (Tata Letak Lengkap + Teks Slide · 4:5)
                </label>
                {slide.isManualPrompt && slide.illustration_scene && (
                  <button
                    type="button"
                    onClick={handleResyncPrompt}
                    className="text-xs font-medium text-[#8B1E24] hover:underline underline-offset-4 cursor-pointer"
                  >
                    Sinkronkan Ulang Otomatis
                  </button>
                )}
              </div>
              <textarea
                id={`prompt-${slide.id}`}
                rows={5}
                value={slide.image_prompt}
                onChange={(e) =>
                  onUpdate(slide.id, {
                    image_prompt: e.target.value,
                    isEdited: true,
                    isManualPrompt: true,
                  })
                }
                className="w-full px-3.5 py-2.5 font-mono text-xs leading-relaxed text-[#2D2523] bg-[#FAF6EF] border border-[#D4C5B4] rounded-lg focus:outline-none focus:border-[#8B1E24] focus:ring-2 focus:ring-[#8B1E24]/15 resize-y"
              />
            </div>
          </div>
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            className="group cursor-text rounded-lg -mx-2 px-2 py-1.5 hover:bg-[#FDFBF7] transition-colors"
            title="Klik untuk mengedit headline atau body copy (langsung tersinkron ke Image Prompt)"
          >
            <h3 className="font-display text-[19px] font-semibold leading-[1.3] text-[#1C1615] text-balance">
              {slide.headline}
            </h3>
            <p className="mt-2 text-[14.5px] leading-[1.65] text-[#4A3F3D]">
              {slide.body_copy}
            </p>
          </div>
        )}
      </div>

      {/* Image Prompt Box (Bounded height + vertical scroll, actions stay outside scroll) */}
      <div className="mt-5 pt-4 border-t border-[#EFE8DE]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C4F4D]">
            <span className="font-medium">
              Image Prompt Terpadu · 4:5 Comic / Anime + Tata Letak &amp; Teks
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-[#8B1E24] font-medium">
              {slide.isManualPrompt ? "Prompt Kustom Manual" : "Auto-Sync Aktif"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {slide.isManualPrompt && slide.illustration_scene && (
              <button
                type="button"
                onClick={handleResyncPrompt}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#8B1E24] hover:bg-[#F3ECE1] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Kembalikan prompt agar sinkron otomatis dengan pengaturan & teks slide"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Auto-Sync</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setModalField("prompt")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#4A3F3D] bg-[#FAF6EF] hover:bg-[#F3ECE1] hover:text-[#1C1615] border border-[#DDD2C4] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Buka Full-Screen Editor untuk melihat atau mengedit prompt secara penuh"
            >
              <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Editor Penuh</span>
            </button>

            <button
              type="button"
              onClick={handleCopyPrompt}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                copiedPrompt
                  ? "bg-[#15803D] text-white"
                  : "bg-[#8B1E24] text-[#FDFBF7] hover:bg-[#72171C]"
              }`}
            >
              {copiedPrompt ? (
                <>
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Prompt Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Salin Prompt</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="relative bg-[#FAF6EF] border border-[#E6DDD1] rounded-lg overflow-hidden">
          <div
            ref={promptScrollRef}
            onScroll={updateScrollFade}
            className="max-h-[156px] overflow-y-auto prompt-scrollbar p-3.5 pr-3"
          >
            <p className="font-mono text-[12px] leading-[1.65] text-[#382F2D] break-words select-all whitespace-pre-line">
              {slide.image_prompt}
            </p>
          </div>

          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#FAF6EF] via-[#FAF6EF]/85 to-transparent transition-opacity duration-200 ${
              showBottomFade ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>
      </div>

      {modalField && (
        <FullScreenTextModal
          isOpen={Boolean(modalField)}
          title={
            modalField === "headline"
              ? `Slide ${index + 1}: Edit Headline (Maks. 4–6 Kata)`
              : modalField === "body"
              ? `Slide ${index + 1}: Edit Body Copy (Maks. 18–24 Kata)`
              : `Slide ${index + 1}: Editor Layar Penuh Image Prompt`
          }
          initialValue={
            modalField === "headline"
              ? slide.headline
              : modalField === "body"
              ? slide.body_copy
              : slide.image_prompt
          }
          placeholder={
            modalField === "headline"
              ? "Ketik headline ringkas (4-6 kata)..."
              : modalField === "body"
              ? "Ketik isi teks body copy (18-24 kata)..."
              : "Ketik atau sesuaikan Unified Image Prompt..."
          }
          onSave={(val) => {
            if (modalField === "headline") handleHeadlineChange(val);
            if (modalField === "body") handleBodyChange(val);
            if (modalField === "prompt") {
              onUpdate(slide.id, {
                image_prompt: val,
                isEdited: true,
                isManualPrompt: true,
              });
            }
            setModalField(null);
          }}
          onClose={() => setModalField(null)}
        />
      )}
    </article>
  );
}
