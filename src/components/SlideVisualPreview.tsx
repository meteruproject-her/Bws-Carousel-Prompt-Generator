import { useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Check, Eye, Search, Shield } from "lucide-react";
import type { CarouselSlide } from "../types/carousel";

interface SlideVisualPreviewProps {
  slides: CarouselSlide[];
  activeIndex: number;
  onChangeIndex: (index: number) => void;
  onEditInList: () => void;
}

export function SlideVisualPreview({
  slides,
  activeIndex,
  onChangeIndex,
  onEditInList,
}: SlideVisualPreviewProps) {
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const safeIndex = Math.min(Math.max(0, activeIndex), slides.length - 1);
  const slide = slides[safeIndex];
  const total = slides.length;
  const pageText = slide.pagination_text || `Slide ${safeIndex + 1} dari ${total}`;

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

  return (
    <div className="w-full min-w-0 bg-white border border-[#E6DDD1] rounded-xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#EFE8DE] min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-xs font-medium text-[#8B1E24] tabular-nums">
            Pratinjau Kanvas 4:5 · {pageText}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 max-w-full">
          <button
            type="button"
            onClick={() => setShowSafeZones((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-[#4A3F3D] bg-[#FAF6EF] border border-[#E6DDD1] hover:border-[#8B1E24]/40 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{showSafeZones ? "Sembunyikan Panduan" : "Tampilkan Panduan"}</span>
          </button>
          <button
            type="button"
            onClick={onEditInList}
            className="px-2.5 sm:px-3 py-1.5 text-xs font-medium text-[#8B1E24] hover:bg-[#8B1E24]/5 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Kembali ke Daftar Kartu
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start w-full min-w-0">
        {/* 4:5 Vertical Card Frame with generous symmetrical margins */}
        <div className="w-full min-w-0 xl:col-span-7 flex flex-col items-center">
          <div
            className="w-full max-w-[400px] aspect-[4/5] bg-[#FDFBF7] border border-[#DDD2C4] rounded-lg px-5 sm:px-9 py-5 sm:py-7 flex flex-col justify-between relative overflow-hidden"
            aria-label={`Mockup 4:5 ${pageText}`}
          >
            {showSafeZones && (
              <div
                className="pointer-events-none absolute inset-y-4 sm:inset-y-5 inset-x-4 sm:inset-x-8 border border-dashed border-[#8B1E24]/25 rounded"
                aria-hidden="true"
              />
            )}

            {/* Locked Top Header: Left (Bawaslu 3-tier) + Right (Ayo Awasi Bersama) */}
            <div className="relative z-10 flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded bg-[#8B1E24] flex items-center justify-center text-[#F59E0B] shrink-0">
                  <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                </div>
                <div className="leading-none">
                  <div className="text-[10px] font-extrabold tracking-tight text-[#1C1615]">
                    BAWASLU
                  </div>
                  <div className="text-[5.5px] font-semibold tracking-wider text-[#4A3F3D] mt-0.5">
                    BADAN PENGAWAS PEMILIHAN UMUM
                  </div>
                  <div className="text-[7px] font-bold tracking-wide text-[#8B1E24] mt-0.5">
                    KABUPATEN PASER
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 text-right shrink-0">
                <div className="w-5 h-5 rounded-full bg-[#1C1615] flex items-center justify-center text-[#8B1E24]">
                  <Search className="w-3 h-3 text-[#FDFBF7]" aria-hidden="true" />
                </div>
                <div className="leading-[1.05] text-left">
                  <div className="text-[6px] font-bold text-[#1C1615]">AYO</div>
                  <div className="text-[7px] font-extrabold text-[#8B1E24]">AWASI</div>
                  <div className="text-[6px] font-bold text-[#1C1615]">BERSAMA</div>
                </div>
              </div>
            </div>

            {/* Dynamic Main Typography (75% max headline width) + 40px Safe Space + Illustration */}
            <div className="relative z-10 my-auto py-3">
              <div>
                <h4 className="max-w-[75%] text-[14.5px] leading-[1.25] font-extrabold text-[#1C1615] text-balance">
                  {slide.headline}
                </h4>
                <p className="mt-2 text-[10.5px] leading-[1.55] text-[#2D2523]">
                  {slide.body_copy}
                </p>

                {/* SWIPE <<< Capsule Badge strictly on Slide 1 when total slides > 1 */}
                {safeIndex === 0 && total > 1 && (
                  <div className="mt-2.5 inline-flex items-center px-2.5 py-0.5 rounded-full border border-[#8B1E24] text-[8.5px] font-extrabold tracking-wider text-[#8B1E24]">
                    SWIPE &lt;&lt;&lt;
                  </div>
                )}
              </div>

              {/* Minimum 40px airy breathing gap before illustration */}
              <div className="mt-7 w-full h-28 rounded-md bg-[#F3ECE1] border border-[#E6DDD1] flex flex-col items-center justify-center p-3 text-center relative">
                {showSafeZones && (
                  <span className="absolute -top-4 left-0 text-[8px] font-mono text-[#8B1E24]/70">
                    Jarak ruang kosong aman min. 40px
                  </span>
                )}
                <div className="w-8 h-0.5 bg-[#8B1E24] rounded-full mb-1.5" />
                <p className="text-[10.5px] font-semibold text-[#1C1615]">
                  Ilustrasi Komik Pengawas Pemilu &amp; Masyarakat
                </p>
                <p className="text-[9.5px] text-[#5C4F4D] mt-0.5">
                  Crisp ink linework · Aksen #8B1E24 · Tanpa balon kata
                </p>
              </div>
            </div>

            {/* Bottom-Right Maroon Page Pill + Locked Official 5-Channel Footer */}
            <div className="relative z-10 space-y-2">
              <div className="flex justify-end">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#8B1E24] text-white text-[9px] font-bold tabular-nums">
                  {pageText}
                </span>
              </div>

              <div className="border-t border-[#D6C9BC] pt-1.5 text-center">
                <p className="text-[7px] font-medium text-[#382F2D] leading-tight tracking-tight">
                  @bawaslukabpaser | Bawaslu Kabupaten Paser | @bawaslu_paser | BawasluPaser | BAWASLU PASER
                </p>
              </div>
            </div>
          </div>

          {/* Slide Stepper */}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => onChangeIndex(Math.max(0, safeIndex - 1))}
              disabled={safeIndex === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-[#DDD2C4] rounded-md text-[#1C1615] hover:bg-[#F7F2EA] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sebelumnya</span>
            </button>
            <span className="font-mono text-xs text-[#5C4F4D] tabular-nums">
              {pageText}
            </span>
            <button
              type="button"
              onClick={() => onChangeIndex(Math.min(total - 1, safeIndex + 1))}
              disabled={safeIndex === total - 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-[#DDD2C4] rounded-md text-[#1C1615] hover:bg-[#F7F2EA] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Prompt Details Side Column */}
        <div className="w-full min-w-0 xl:col-span-5 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-[#1C1615]">
              Spesifikasi Komposisi ({pageText})
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-[#5C4F4D]">
              Margin kiri-kanan simetris minimal 56px, judul maksimal 75% lebar area dalam (12.5pt), isi 2–3 baris pendek (10pt), jarak kosong minimal 40px di atas ilustrasi, kapsul {pageText}, dan footer 5 kanal resmi.
            </p>
          </div>

          <div className="w-full min-w-0 bg-[#FAF6EF] border border-[#E6DDD1] rounded-lg p-3.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-[#5C4F4D]">Image Prompt</span>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer shrink-0 ${
                  copiedPrompt
                    ? "bg-[#15803D] text-white"
                    : "bg-[#8B1E24] text-[#FDFBF7] hover:bg-[#72171C]"
                }`}
              >
                {copiedPrompt ? (
                  <>
                    <Check className="w-3 h-3" aria-hidden="true" />
                    <span>Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" aria-hidden="true" />
                    <span>Copy Image Prompt</span>
                  </>
                )}
              </button>
            </div>
            <div className="max-h-[156px] overflow-y-auto prompt-scrollbar pr-1">
              <p className="font-mono text-[11.5px] leading-relaxed text-[#382F2D] break-words [overflow-wrap:anywhere] select-all whitespace-pre-line">
                {slide.image_prompt}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
