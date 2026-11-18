export interface CarouselSlide {
  id: string;
  slide_number: string;
  pagination_text: string;
  headline: string;
  headline_accent?: string;
  body_copy: string;
  body_accents?: string;
  illustration_scene?: string;
  image_prompt: string;
  isEdited?: boolean;
  isManualPrompt?: boolean;
}

export interface CarouselBlueprint {
  title: string;
  slides: CarouselSlide[];
}

export interface SourcePreset {
  id: string;
  label: string;
  category: string;
  text: string;
}
