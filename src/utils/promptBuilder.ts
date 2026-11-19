import {
  DEFAULT_COMPOSITION_RULES,
  type CompositionRules,
} from "../constants/defaultRules.ts";

export interface PromptBuildInput {
  slideIndex: number;
  totalSlides: number;
  headline: string;
  headlineAccent?: string;
  bodyCopy: string;
  bodyAccents?: string;
  illustrationScene: string;
  rules: CompositionRules;
}

function containsPhrase(haystack: string, needle?: string): string {
  const cleanNeedle = (needle ?? "").trim();
  if (!cleanNeedle) return "";
  if (haystack.toLowerCase().includes(cleanNeedle.toLowerCase())) {
    return cleanNeedle;
  }
  return "";
}

const GENERIC_DEPICTION_SENTENCE =
  /Depict Indonesian\/Paser election supervisors or local community members naturally relevant to each slide topic in the middle-to-lower frame\.?\s*/gi;

export function buildLockedImagePrompt(params: PromptBuildInput): string {
  const {
    slideIndex,
    totalSlides,
    headline,
    headlineAccent,
    bodyCopy,
    bodyAccents,
    illustrationScene,
    rules,
  } = params;

  const slideNum = slideIndex + 1;

  const resolvedPaging = rules.pagingFormat
    .replace(/\s*\((?:example|contoh)\s*:[^)]*\)/gi, "")
    .replace(/\[X\]|\[Nomor\]/gi, String(slideNum))
    .replace(/\[Y\]|\[Total\]/gi, String(totalSlides))
    .replace(/\s+\./g, ".")
    .trim();

  const validHeadlineAccent = containsPhrase(headline, headlineAccent);
  const validBodyAccents = containsPhrase(bodyCopy, bodyAccents);

  const headlineInstruction = validHeadlineAccent
    ? `Tampilkan judul (headline) persis "${headline}" dengan kata "${validHeadlineAccent}" disorot di dalam kotak persegi panjang merah marun solid dengan teks putih.`
    : `Tampilkan judul (headline) persis "${headline}".`;

  const bodyInstruction = validBodyAccents
    ? `Tepat di bawahnya, tampilkan subteks (body copy) persis "${bodyCopy}" dengan kata "${validBodyAccents}" berwarna merah marun gelap.`
    : `Tepat di bawahnya, tampilkan subteks (body copy) persis "${bodyCopy}".`;

  const isDefaultSwipeRule =
    rules.swipeAndClearance.trim() ===
    DEFAULT_COMPOSITION_RULES.swipeAndClearance.trim();

  let swipeSection: string;
  if (totalSlides <= 1) {
    swipeSection = `Jarak Aman Ilustrasi: Sisakan ruang kosong krem hangat yang bersih minimal 40px tepat di bawah blok body copy sebelum ilustrasi karakter dimulai agar kepala karakter tidak menumpuk atau bertabrakan dengan teks (no text overlap).`;
  } else if (isDefaultSwipeRule) {
    swipeSection =
      slideNum === 1 && totalSlides > 1
        ? `Lencana SWIPE Slide 1 & Jarak Aman Ilustrasi: Tepat di bawah body copy di sisi kiri, tempatkan lencana kapsul bergaris tepi merah marun (#8B1E24) dengan teks tebal merah marun bertuliskan "SWIPE <<<" dilengkapi tiga panah mengarah ke kiri, diikuti ruang kosong krem hangat minimal 40px di bawah lencana sebelum ilustrasi karakter dimulai agar kepala karakter tidak bertabrakan dengan teks (no text overlap).`
        : `Jarak Aman Ilustrasi: Sisakan ruang kosong krem hangat yang bersih minimal 40px tepat di bawah blok body copy sebelum ilustrasi karakter dimulai agar kepala karakter tidak menumpuk atau bertabrakan dengan teks (no text overlap).`;
  } else {
    swipeSection = `Aturan SWIPE & Jarak Aman Ilustrasi untuk Slide ${slideNum} dari ${totalSlides}: ${rules.swipeAndClearance}`;
  }

  const cleanIllustrationStyle = rules.illustrationStyle
    .replace(GENERIC_DEPICTION_SENTENCE, "")
    .trim();

  const sections: string[] = [
    rules.referenceAnchor,
    `Kanvas & Palet Warna: ${rules.paletteAndRatio}`,
    `Header Atas Terkunci: ${rules.headerBranding}`,
    `Margin, Tipografi & Ruang Kosong: ${rules.typographyAndMargins} ${headlineInstruction} ${bodyInstruction}`,
    swipeSection,
    `Ilustrasi Utama pada bagian tengah hingga bawah kanvas: ${cleanIllustrationStyle} Deskripsi Adegan: ${illustrationScene}`,
    `Format & Posisi Penomoran Halaman: ${resolvedPaging}`,
    `Footer Resmi: ${rules.officialFooter}`,
  ];

  return sections.join("\n\n");
}
