import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlatformDimensions } from "@/lib/templates/dimensions";
import { loadBrandContext, loadBrandTokens } from "@/lib/templates/brand-tokens";
import { buildImagePrompt } from "@/lib/templates/prompt-builder";
import { renderOverlayToPng } from "@/lib/templates/renderer";
import { compositeImage } from "@/lib/templates/compositor";
import { findSystemTemplate } from "@/lib/templates/system-templates";
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

  // ─── Gemini Setup ─────────────────────────────────────────────────────────

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-image-preview" });

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
    const visualDirection = [customInstruction, slideDef.aiPromptHint].filter(Boolean).join(". ");
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
      customInstruction: "This is a BACKGROUND IMAGE ONLY — text will be overlaid separately. Generate a purely visual scene with absolutely NO text, words, letters, or numbers anywhere in the image.",
    });

    // 2. Generate background image via Gemini
    const reqParts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
    if (referenceImage?.base64 && referenceImage?.mimeType) {
      reqParts.push({ inlineData: { data: referenceImage.base64, mimeType: referenceImage.mimeType } });
    }
    reqParts.push({ text: `${prompt}\n\nAvoid: ${negativePrompt}` });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: reqParts }],
      generationConfig: {
        // @ts-ignore — responseModalities
        responseModalities: ["IMAGE", "TEXT"],
      },
    });

    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
    // @ts-ignore
    const imagePart = parts.find((p) => p.inlineData?.mimeType?.startsWith("image/"));

    if (!imagePart || !("inlineData" in imagePart)) {
      throw new Error(`No image returned for slide: ${slideDef.name}`);
    }

    // @ts-ignore
    const imageBase64: string = imagePart.inlineData.data;

    // 3. Render text overlay
    const overlayPng = await renderOverlayToPng(
      slideDef.overlayStyle,
      fieldValues,
      brandTokens,
      dims
    );

    // 4. Composite overlay onto background
    const backgroundBuffer = Buffer.from(imageBase64, "base64");
    const finalImage = await compositeImage(backgroundBuffer, overlayPng, dims.width, dims.height);

    results.push({
      slideId: slideDef.id,
      imageBuffer: finalImage,
      mimeType: "image/jpeg",
    });
  }

  return results;
}
