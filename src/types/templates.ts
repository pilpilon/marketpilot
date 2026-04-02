// ─── Template System Types ───────────────────────────────────────────────────

export type TemplateCategory =
  | "promotional"
  | "educational"
  | "quote"
  | "product_showcase"
  | "testimonial"
  | "announcement"
  | "behind_the_scenes"
  | "event"
  | "question_poll"
  | "statistic"
  | "listicle"
  | "comparison"
  | "ugc"
  | "story_cover";

export type OverlayStyle =
  | "centered"
  | "bottom_bar"
  | "gradient_overlay"
  | "full_overlay"
  | "split_layout"
  | "boxed_badge"
  | "corner";

export type ContentFormat = "single" | "carousel" | "story";

export type SlideRole = "hook" | "content" | "cta" | "standalone";

// ─── Platform Dimensions ─────────────────────────────────────────────────────

export interface PlatformDimensions {
  width: number;
  height: number;
  aspectRatio: string;
  safeZone: { top: number; bottom: number; left: number; right: number };
}

// ─── Template Fields ─────────────────────────────────────────────────────────

export interface TemplateField {
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  placeholder: string;
  maxLength?: number;
  required: boolean;
  defaultValue?: string;
  options?: { value: string; label: string }[];
}

// ─── Slide Definition ────────────────────────────────────────────────────────

export interface SlideDefinition {
  id: string;
  name: string;
  role: SlideRole;
  fields: TemplateField[];
  overlayStyle: OverlayStyle;
  /** Hint appended to the AI image prompt for this slide's background */
  aiPromptHint: string;
}

// ─── Content Template ────────────────────────────────────────────────────────

export interface ContentTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  format: ContentFormat;
  thumbnailUrl?: string;
  platforms: string[];
  slides: SlideDefinition[];
  defaultOverlayStyle: OverlayStyle;
  brandTokens: {
    useBrandColors: boolean;
    useBrandFonts: boolean;
    useLogoWatermark: boolean;
  };
  isSystem: boolean;
}

// ─── Brand Tokens (resolved at render time) ──────────────────────────────────

export interface BrandTokens {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  headingFont: string;
  bodyFont: string;
  logoUrl?: string;
}

// ─── Overlay Renderer Function ───────────────────────────────────────────────

export interface FittedSizes {
  headline: number;
  subheadline: number;
}

export type OverlayRenderer = (
  fields: Record<string, string>,
  brand: BrandTokens,
  dims: PlatformDimensions,
  fittedSizes?: FittedSizes
) => React.ReactElement;

// ─── API Request / Response ──────────────────────────────────────────────────

export interface TemplateRenderRequest {
  projectId: string;
  templateId: string;
  platform: string;
  campaignId?: string;
  modelTier?: "nb2" | "pro";
  customInstruction?: string;
  slides: Array<{
    slideId: string;
    fieldValues: Record<string, string>;
  }>;
  brandOverrides?: Partial<BrandTokens>;
}

export interface TemplateRenderResult {
  slideId: string;
  imageUrl: string;
  assetId: string;
}

export interface TemplateRenderResponse {
  campaignId: string;
  templateId: string;
  platform: string;
  slides: TemplateRenderResult[];
}
