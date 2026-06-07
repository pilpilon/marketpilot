import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlatformDimensions } from "@/lib/templates/dimensions";
import { loadBrandContext, loadBrandTokens } from "@/lib/templates/brand-tokens";
import { buildImagePrompt } from "@/lib/templates/prompt-builder";
import { renderOverlayToPng } from "@/lib/templates/renderer";
import { compositeImage } from "@/lib/templates/compositor";
import { findSystemTemplate } from "@/lib/templates/system-templates";
import { generateMarketingImage } from "@/lib/ai/image-generation";
import { detectDirection } from "@/lib/templates/overlays/utils";
import type { BrandTokens, ContentTemplate, OverlayStyle } from "@/types/templates";

// ─── Public Interface ─────────────────────────────────────────────────────────

export interface RenderTemplateImageParams {
  supabase: SupabaseClient;
  projectId: string;
  templateId: string;
  platform: string;
  slides: Array<{ slideId: string; fieldValues: Record<string, string> }>;
  brandOverrides?: Partial<BrandTokens>;
  customInstruction?: string;
  referenceImage?: { base64: string; mimeType: string };
}

export interface RenderTemplateImageResult {
  slideId: string;
  imageBuffer: Buffer;
  mimeType: string;
  provider: string;
  model: string;
}

function getOverlaySafeAreaInstruction(
  overlayStyle: OverlayStyle,
  fields: Record<string, string>
): string {
  if (overlayStyle !== "split_layout") return "";

  const dir = detectDirection(fields);
  const textSide = dir === "rtl" ? "RIGHT" : "LEFT";
  const imageSide = dir === "rtl" ? "LEFT" : "RIGHT";

  return [
    `Split-layout composition: the ${textSide} 50% of the final image will be covered by a solid text panel after generation.`,
    `Keep the main person/product/face/action entirely inside the ${imageSide} 50% of the frame, with comfortable margin from the center line.`,
    `The ${textSide} half must be clean negative space/background only — no faces, hands, key product details, or important subject matter there.`,
    "Do not crop the subject at the center split. Compose as if a magazine layout text block will be placed on the reserved half.",
  ].join(" ");
}

/**
 * Core template rendering: AI background + text overlay + composite.
 * Does NOT handle auth, storage upload, asset saving, or caption generation.
 */
export async function renderTemplateImage(
  params: RenderTemplateImageParams
): Promise<RenderTemplateImageResult[]> {
  const {
    supabase,
    projectId,
    templateId,
    platform,
    slides: slideInputs,
    brandOverrides,
    customInstruction,
    referenceImage,
  } = params;

  // ─── Load Template ────────────────────────────────────────────────────────

  let template: ContentTemplate | undefined = findSystemTemplate(templateId);

  if (!template) {
    const { data: dbTemplate } = await supabase
      .from("content_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (dbTemplate) {
      template = {
        id: dbTemplate.id,
        name: dbTemplate.name,
        description: dbTemplate.description || "",
        category: dbTemplate.category as ContentTemplate["category"],
        format: dbTemplate.format as ContentTemplate["format"],
        platforms: dbTemplate.platforms || [],
        slides: (dbTemplate.slides as unknown as ContentTemplate["slides"]) || [],
        defaultOverlayStyle: dbTemplate.default_overlay_style as OverlayStyle,
        brandTokens: (dbTemplate.brand_tokens as unknown as ContentTemplate["brandTokens"]) || {
          useBrandColors: true,
          useBrandFonts: true,
          useLogoWatermark: false,
        },
        isSystem: dbTemplate.is_system,
      };
    }
  }

  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // ─── Load Brand Context + Tokens ──────────────────────────────────────────

  const [brandContext, brandTokens] = await Promise.all([
    loadBrandContext(supabase, projectId),
    loadBrandTokens(supabase, projectId, brandOverrides),
  ]);

  const dims = getPlatformDimensions(platform);

  // ─── Process Each Slide ───────────────────────────────────────────────────

  const results: RenderTemplateImageResult[] = [];

  for (const slideInput of slideInputs) {
    const slideDef = template.slides.find((s) => s.id === slideInput.slideId);
    if (!slideDef) continue;

    const fieldValues = slideInput.fieldValues || {};

    // 1. Build AI background prompt
    // For template renders, use the visual description (customInstruction) as
    // the primary content — NOT the raw headline/subheadline text.  Sending
    // the actual text to Gemini causes it to render words into the background
    // image even though the prompt says "no text".  The text overlay is added
    // separately by the Takumi compositor.
    const overlaySafeAreaInstruction = getOverlaySafeAreaInstruction(
      slideDef.overlayStyle,
      fieldValues
    );
    const visualDirection = [customInstruction, slideDef.aiPromptHint, overlaySafeAreaInstruction]
      .filter(Boolean)
      .join(". ");
    const { prompt, negativePrompt } = buildImagePrompt({
      postContent: visualDirection || `Background image for a ${template.category} social media post`,
      platform,
      styleKeywords: brandContext.visual.styleKeywords,
      colorPalette: brandContext.visual.colorPalette,
      visualDonts: brandContext.visual.visualDonts,
      brandPersonality: brandContext.brandPersonality,
      audienceContext: brandContext.audienceContext,
      brandPositioning: brandContext.brandPositioning,
      productContext: brandContext.productContext,
      intakePatterns: brandContext.intakePatterns,
      hasReferenceImage: !!referenceImage,
      customInstruction: [
        "This is a BACKGROUND IMAGE ONLY — text will be overlaid separately.",
        "Generate a purely visual scene with absolutely NO text, words, letters, or numbers anywhere in the image.",
        overlaySafeAreaInstruction,
      ].filter(Boolean).join(" "),
    });

    // 2. Generate background image via the shared provider abstraction.
    // OpenAI is used when IMAGE_PROVIDER=openai, with Gemini fallback.
    // This keeps Creative Designer template mode and Content Calendar aligned
    // with the same high-quality image path as freeform creative generation.
    const generatedImage = await generateMarketingImage({
      prompt,
      negativePrompt,
      aspectRatio: dims.aspectRatio,
      referenceImage,
    });

    // 3. Render text overlay
    const overlayPng = await renderOverlayToPng(
      slideDef.overlayStyle,
      fieldValues,
      brandTokens,
      dims
    );

    // 4. Composite overlay onto background
    const backgroundBuffer = Buffer.from(generatedImage.base64, "base64");
    const finalImage = await compositeImage(backgroundBuffer, overlayPng, dims.width, dims.height);

    results.push({
      slideId: slideDef.id,
      imageBuffer: finalImage,
      mimeType: "image/jpeg",
      provider: generatedImage.provider,
      model: generatedImage.model,
    });
  }

  return results;
}
