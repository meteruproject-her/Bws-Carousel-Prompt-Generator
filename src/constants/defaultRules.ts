export interface CompositionRules {
  referenceAnchor: string;
  headerBranding: string;
  typographyAndMargins: string;
  swipeAndClearance: string;
  illustrationStyle: string;
  pagingFormat: string;
  officialFooter: string;
  paletteAndRatio: string;
}

export const DEFAULT_COMPOSITION_RULES: CompositionRules = {
  referenceAnchor:
    "Use the attached layout reference image ONLY to replicate the exact header logos, warm cream background (#FDFBF7), typography hierarchy, wide outer margins, and bottom social media footer. Generate a completely fresh, original character pose, facial expression, and background scene strictly matching the Scene Description below, without copying the character pose from the reference image.",
  headerBranding:
    'On the top-left corner, maintain the official gold-and-red Bawaslu shield/ballot-box emblem followed by the three-line stacked typography: "BAWASLU" (large heavy bold), "BADAN PENGAWAS PEMILIHAN UMUM" (small), and "KABUPATEN PASER" (medium). On the top-right corner, maintain the black-and-red "AYO AWASI BERSAMA" campaign logo (magnifying glass icon with stacked campaign block text).',
  typographyAndMargins:
    "Enforce wide, symmetrical left and right outer margins (minimum 56px padding on both sides) and generous vertical breathing room between sections so the upper canvas remains airy, clean, and uncrowded. Render the headline in medium-proportional bold pitch-black sans-serif font (12.5pt visual hierarchy), max 4-6 words and strictly occupying at most 75% of the inner canvas width, with 1-2 key words highlighted inside a solid dark maroon (#8B1E24) rectangular box with white text. Beneath it, render body copy (max 18-24 words, 2-3 short lines) left-aligned in clean charcoal-black sans-serif font (10pt visual hierarchy) with key words colored dark maroon (#8B1E24).",
  swipeAndClearance:
    'On Slide 1 only when total slides > 1, place a compact maroon-outlined (#8B1E24) capsule badge with bold dark maroon text reading "SWIPE <<<" featuring three left-pointing arrows directly beneath the body copy on the left side, followed by at least 40px of clean empty breathing space before the illustration begins. On Slide 2 and onwards, or for single-slide posts (1 of 1), omit the SWIPE badge completely while maintaining at least 40px of clean empty breathing space beneath the body copy so character heads never crowd the text.',
  illustrationStyle:
    "Comic book and anime digital illustration style with crisp ink linework, warm editorial lighting, and dark maroon (#8B1E24) accent highlights. Strictly no comic dialogue speech bubbles and no embedded dialogue text.",
  pagingFormat:
    'Omit all pagination dots completely. In the bottom-right corner directly above the footer divider line, render a dark maroon (#8B1E24) capsule pill containing bold white text reading "Slide [X] dari [Y]".',
  officialFooter:
    "At the very bottom, preserve the full-width thin horizontal divider line followed by a single horizontal row of 5 original full-color social media icons and official account text separated by thin vertical bars: [Instagram icon] @bawaslukabpaser | [Facebook icon] Bawaslu Kabupaten Paser | [TikTok icon] @bawaslu_paser | [X icon] BawasluPaser | [YouTube icon] BAWASLU PASER.",
  paletteAndRatio:
    "4:5 vertical aspect ratio (1080x1350 px), clean warm cream background (#FDFBF7), dark maroon accent highlights (#8B1E24), pitch-black headline ink (#1C1615), and charcoal body ink.",
};

export const LEGACY_DEFAULT_COMPOSITION_RULES: Partial<
  Record<keyof CompositionRules, string[]>
> = {
  referenceAnchor: [
    "Using the attached layout reference image as a strict structural and branding anchor, replicate the exact header logos, warm cream background (#FDFBF7), typography style, and bottom social media footer layout without altering any official emblems.",
  ],
  swipeAndClearance: [
    'On Slide 1 only, place a compact maroon-outlined (#8B1E24) capsule badge with bold dark maroon text reading "SWIPE <<<" (three left-pointing arrows) directly beneath the body copy on the left side, followed by at least 40px of clean empty breathing space before the illustration begins. On Slide 2 and onwards, omit the SWIPE badge completely while maintaining at least 40px of clean empty breathing space beneath the body copy so character heads never crowd the text.',
    'On Slide 1 only, place a compact maroon-outlined (#8B1E24) capsule badge with bold dark maroon text reading "SWIPE <<<" featuring three left-pointing arrows directly beneath the body copy on the left side, followed by at least 40px of clean empty breathing space before the illustration begins. On Slide 2 and onwards, omit the SWIPE badge completely while maintaining at least 40px of clean empty breathing space beneath the body copy so character heads never crowd the text.',
  ],
  illustrationStyle: [
    "Comic book and anime digital illustration style with crisp ink linework, warm editorial lighting, and dark maroon (#8B1E24) accent highlights. Depict Indonesian/Paser election supervisors or local community members naturally relevant to each slide topic in the middle-to-lower frame. Strictly no comic dialogue speech bubbles and no embedded dialogue text.",
  ],
  pagingFormat: [
    'Omit all pagination dots completely. In the bottom-right corner directly above the footer divider line, render a dark maroon (#8B1E24) capsule pill containing bold white text reading "Slide [X] dari [Y]" (example: "Slide 1 dari 5").',
  ],
};

export interface CompositionRuleMeta {
  key: keyof CompositionRules;
  number: string;
  title: string;
  helper: string;
  rows: number;
}

export const COMPOSITION_RULE_FIELDS: CompositionRuleMeta[] = [
  {
    key: "referenceAnchor",
    number: "01",
    title: "Penegas Gambar Referensi (Reference Anchor)",
    helper: "Mengunci header, footer, margin, dan warna latar dari gambar referensi tanpa meniru pose karakter.",
    rows: 4,
  },
  {
    key: "headerBranding",
    number: "02",
    title: "Header Kiri & Kanan (Official Header Logos)",
    helper: "Aturan logo perisai Bawaslu Kabupaten Paser di kiri atas dan logo kampanye Ayo Awasi Bersama di kanan atas.",
    rows: 4,
  },
  {
    key: "typographyAndMargins",
    number: "03",
    title: "Margin, Skala Tipografi & White Space",
    helper: "Mengatur margin simetris (56px), skala 12.5pt/10pt, batas lebar headline 75%, dan batas kata.",
    rows: 5,
  },
  {
    key: "swipeAndClearance",
    number: "04",
    title: "Simbol SWIPE Slide 1 & Jarak Aman Ilustrasi",
    helper: "Aturan lencana SWIPE <<< khusus Slide 1 dan ruang napas minimal 40px di atas ilustrasi.",
    rows: 4,
  },
  {
    key: "illustrationStyle",
    number: "05",
    title: "Gaya & Arah Ilustrasi Utama",
    helper: "Standar gaya comic book & anime digital illustration, garis tinta tegas, tanpa balon kata dialog.",
    rows: 3,
  },
  {
    key: "pagingFormat",
    number: "06",
    title: "Format & Posisi Paging",
    helper: "Gunakan placeholder [X] dan [Y] untuk nomor dan total slide (default: 'Slide [X] dari [Y]' tanpa dot).",
    rows: 3,
  },
  {
    key: "officialFooter",
    number: "07",
    title: "Footer Resmi Media Sosial",
    helper: "Garis pemisah penuh serta susunan 5 akun media sosial resmi Bawaslu Kabupaten Paser.",
    rows: 3,
  },
  {
    key: "paletteAndRatio",
    number: "08",
    title: "Palet Warna & Rasio Kanvas",
    helper: "Standar dimensi 4:5 vertical, latar krem #FDFBF7, aksen merah marun #8B1E24, dan warna tinta teks.",
    rows: 2,
  },
];

export function countCustomizedRules(rules: CompositionRules): number {
  let count = 0;
  for (const field of COMPOSITION_RULE_FIELDS) {
    if (rules[field.key].trim() !== DEFAULT_COMPOSITION_RULES[field.key].trim()) {
      count += 1;
    }
  }
  return count;
}
