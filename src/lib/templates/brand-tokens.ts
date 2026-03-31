import type { BrandTokens } from "@/types/templates";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_BRAND: BrandTokens = {
  primaryColor: "#1a1a2e",
  secondaryColor: "#16213e",
  accentColor: "#e94560",
  backgroundColor: "#0f0f23",
  textColor: "#ffffff",
  headingFont: "Inter",
  bodyFont: "Inter",
};

/**
 * Extract color palette and visual style keywords from the visual_style context file.
 */
export function parseVisualStyle(content: string): {
  styleKeywords: string;
  colorPalette: string;
  visualDos: string;
  visualDonts: string;
} {
  const colorMatch = content.match(/##?\s*Color[^\n]*\n([\s\S]*?)(?=##|$)/i);
  const typographyMatch = content.match(/##?\s*Typography[^\n]*\n([\s\S]*?)(?=##|$)/i);
  const imageryMatch = content.match(/##?\s*Imagery[^\n]*\n([\s\S]*?)(?=##|$)/i);
  const dosMatch = content.match(/##?\s*.*[Dd]o[^n][^\n]*\n([\s\S]*?)(?=##|$)/i);
  const dontsMatch = content.match(/##?\s*.*[Dd]on.t[^\n]*\n([\s\S]*?)(?=##|$)/i);

  const colorPalette = colorMatch?.[1]?.trim().slice(0, 300) ?? "professional, modern";
  const imageryStyle = imageryMatch?.[1]?.trim().slice(0, 200) ?? "";
  const typography = typographyMatch?.[1]?.trim().slice(0, 100) ?? "";

  const styleKeywords = [imageryStyle, typography]
    .filter(Boolean)
    .join(". ")
    .slice(0, 400);

  return {
    styleKeywords: styleKeywords || "clean, professional, modern",
    colorPalette,
    visualDos: dosMatch?.[1]?.trim().slice(0, 200) ?? "",
    visualDonts: dontsMatch?.[1]?.trim().slice(0, 200) ?? "",
  };
}

/**
 * Extract hex colors from a visual style text block.
 */
function extractColors(text: string): string[] {
  const hexPattern = /#[0-9a-fA-F]{6}\b/g;
  return [...new Set(text.match(hexPattern) || [])];
}

/**
 * Load BrandTokens from project context_files.
 */
export async function loadBrandTokens(
  supabase: SupabaseClient,
  projectId: string,
  overrides?: Partial<BrandTokens>
): Promise<BrandTokens> {
  const { data: contextFiles } = await supabase
    .from("context_files")
    .select("file_type, content")
    .eq("project_id", projectId)
    .in("file_type", ["visual_style", "character_brief"]);

  const files = (contextFiles || []) as Array<{ file_type: string; content: string }>;
  const visualStyleFile = files.find((f) => f.file_type === "visual_style");

  let brand = { ...DEFAULT_BRAND };

  if (visualStyleFile) {
    const colors = extractColors(visualStyleFile.content);
    if (colors.length >= 1) brand.primaryColor = colors[0];
    if (colors.length >= 2) brand.secondaryColor = colors[1];
    if (colors.length >= 3) brand.accentColor = colors[2];

    // Try to extract font info
    const fontMatch = visualStyleFile.content.match(/font[^:]*:\s*([A-Za-z\s]+)/i);
    if (fontMatch) {
      brand.headingFont = fontMatch[1].trim();
      brand.bodyFont = fontMatch[1].trim();
    }
  }

  // Apply any overrides
  if (overrides) {
    brand = { ...brand, ...overrides };
  }

  return brand;
}

/**
 * Load the raw visual style and character brief for image prompt building.
 */
/**
 * Extract audience/persona summary for image prompt guidance.
 * Pulls demographics, psychographics, and key descriptors so AI-generated
 * images depict the right people and scenarios.
 */
function parseAudienceContext(content: string): string {
  // Extract persona sections
  const personaBlocks = content.match(/\*\*Persona[^*]*\*\*[^]*?(?=\*\*Persona|\n###|$)/gi) || [];
  const summaries: string[] = [];
  for (const block of personaBlocks.slice(0, 3)) {
    const demoMatch = block.match(/Demographics?:\s*([^\n]+)/i);
    const psychoMatch = block.match(/Psychographics?:\s*([^\n]+)/i);
    const titleMatch = block.match(/Job\s*titles?:\s*([^\n]+)/i);
    const parts = [demoMatch?.[1], psychoMatch?.[1], titleMatch?.[1]].filter(Boolean);
    if (parts.length) summaries.push(parts.join("; ").slice(0, 200));
  }
  return summaries.join(" | ").slice(0, 500);
}

/**
 * Extract brand positioning summary for image prompt context.
 */
function parseBrandContext(content: string): string {
  const positionMatch = content.match(/##?\s*(?:Brand\s+)?Position[^\n]*\n([\s\S]*?)(?=##|$)/i);
  const promiseMatch = content.match(/##?\s*(?:Brand\s+)?Promise[^\n]*\n([\s\S]*?)(?=##|$)/i);
  const parts = [
    positionMatch?.[1]?.trim().slice(0, 200),
    promiseMatch?.[1]?.trim().slice(0, 200),
  ].filter(Boolean);
  return parts.join(". ").slice(0, 350);
}

/**
 * Extract visual patterns from intake/examples analysis.
 * Pulls recurring visual themes, composition styles, and content patterns
 * that the brand's successful content uses.
 */
function parseIntakePatterns(content: string): string {
  const visualMatch = content.match(/##?\s*Visual[^\n]*\n([\s\S]*?)(?=##|$)/i);
  const styleMatch = content.match(/##?\s*Style[^\n]*\n([\s\S]*?)(?=##|$)/i);
  const patternMatch = content.match(/##?\s*(?:Content\s+)?Pattern[^\n]*\n([\s\S]*?)(?=##|$)/i);
  const hookMatch = content.match(/##?\s*Hook[^\n]*\n([\s\S]*?)(?=##|$)/i);
  const parts = [
    visualMatch?.[1]?.trim().slice(0, 200),
    styleMatch?.[1]?.trim().slice(0, 150),
    patternMatch?.[1]?.trim().slice(0, 150),
    hookMatch?.[1]?.trim().slice(0, 100),
  ].filter(Boolean);
  return parts.join(". ").slice(0, 400);
}

/**
 * Extract product context for image prompt relevance.
 */
function parseProductContext(content: string): string {
  const valueMatch = content.match(/##?\s*(?:Core\s+)?Value\s+Prop[^\n]*\n([\s\S]*?)(?=##|$)/i);
  const useCaseMatch = content.match(/##?\s*Use\s+Case[^\n]*\n([\s\S]*?)(?=##|$)/i);
  const parts = [
    valueMatch?.[1]?.trim().slice(0, 200),
    useCaseMatch?.[1]?.trim().slice(0, 150),
  ].filter(Boolean);
  return parts.join(". ").slice(0, 300);
}

export async function loadBrandContext(
  supabase: SupabaseClient,
  projectId: string
): Promise<{
  visual: ReturnType<typeof parseVisualStyle>;
  brandPersonality: string;
  audienceContext: string;
  brandPositioning: string;
  productContext: string;
  intakePatterns: string;
}> {
  const { data: contextFiles } = await supabase
    .from("context_files")
    .select("file_type, content")
    .eq("project_id", projectId)
    .in("file_type", ["visual_style", "character_brief", "audience", "brand", "product", "intake"]);

  const files = (contextFiles || []) as Array<{ file_type: string; content: string }>;
  const visualStyleFile = files.find((f) => f.file_type === "visual_style");
  const characterBriefFile = files.find((f) => f.file_type === "character_brief");
  const audienceFile = files.find((f) => f.file_type === "audience");
  const brandFile = files.find((f) => f.file_type === "brand");
  const productFile = files.find((f) => f.file_type === "product");
  const intakeFile = files.find((f) => f.file_type === "intake");

  const visual = visualStyleFile
    ? parseVisualStyle(visualStyleFile.content)
    : {
        styleKeywords: "clean, modern, professional",
        colorPalette: "neutral tones, professional palette",
        visualDos: "",
        visualDonts: "",
      };

  const brandPersonality = characterBriefFile
    ? characterBriefFile.content.slice(0, 300)
    : "professional, trustworthy, modern";

  const audienceContext = audienceFile ? parseAudienceContext(audienceFile.content) : "";
  const brandPositioning = brandFile ? parseBrandContext(brandFile.content) : "";
  const productContext = productFile ? parseProductContext(productFile.content) : "";
  const intakePatterns = intakeFile ? parseIntakePatterns(intakeFile.content) : "";

  return { visual, brandPersonality, audienceContext, brandPositioning, productContext, intakePatterns };
}
