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
    ? `Render the exact headline "${headline}" with "${validHeadlineAccent}" highlighted inside the solid dark maroon rectangular box in white text.`
    : `Render the exact headline "${headline}".`;

  const bodyInstruction = validBodyAccents
    ? `Directly beneath it, render the exact body copy "${bodyCopy}" with "${validBodyAccents}" colored dark maroon.`
    : `Directly beneath it, render the exact body copy "${bodyCopy}".`;

  const isDefaultSwipeRule =
    rules.swipeAndClearance.trim() ===
    DEFAULT_COMPOSITION_RULES.swipeAndClearance.trim();

  let swipeSection: string;
  if (totalSlides <= 1) {
    swipeSection = `Safe Illustration Clearance: Leave at least 40px of clean empty warm-cream breathing space directly beneath the body copy block before the character illustration begins so character heads never crowd or overlap the text.`;
  } else if (isDefaultSwipeRule) {
    swipeSection =
      slideNum === 1 && totalSlides > 1
        ? `Slide 1 SWIPE Badge & Safe Illustration Clearance: Directly beneath the body copy on the left side, place a compact maroon-outlined (#8B1E24) capsule badge with bold dark maroon text reading "SWIPE <<<" featuring three left-pointing arrows, followed by at least 40px of clean empty warm-cream breathing space below the badge before the character illustration begins so character heads never crowd the text.`
        : `Safe Illustration Clearance: Leave at least 40px of clean empty warm-cream breathing space directly beneath the body copy block before the character illustration begins so character heads never crowd or overlap the text.`;
  } else {
    swipeSection = `SWIPE & Illustration Clearance for Slide ${slideNum} of ${totalSlides}: ${rules.swipeAndClearance}`;
  }

  const cleanIllustrationStyle = rules.illustrationStyle
    .replace(GENERIC_DEPICTION_SENTENCE, "")
    .trim();

  const sections: string[] = [
    rules.referenceAnchor,
    `Canvas & Color Palette: ${rules.paletteAndRatio}`,
    `Locked Top Header: ${rules.headerBranding}`,
    `Margins, Typography & White Space: ${rules.typographyAndMargins} ${headlineInstruction} ${bodyInstruction}`,
    swipeSection,
    `Main Illustration in the middle-to-lower frame: ${cleanIllustrationStyle} Scene Description: ${illustrationScene}`,
    `Pagination Format & Position: ${resolvedPaging}`,
    `Official Footer: ${rules.officialFooter}`,
  ];

  return sections.join("\n\n");
}
