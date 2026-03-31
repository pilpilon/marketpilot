import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { PLATFORM_RATIOS } from "@/lib/templates/dimensions";
import { getPlatformDimensions } from "@/lib/templates/dimensions";
import { loadBrandContext, loadBrandTokens } from "@/lib/templates/brand-tokens";
import { buildImagePrompt } from "@/lib/templates/prompt-builder";
import { renderOverlayToPng } from "@/lib/templates/renderer";
import { compositeImage } from "@/lib/templates/compositor";
import { findSystemTemplate } from "@/lib/templates/system-templates";
import { getCondensedStorytellingGuidance } from "@/lib/ai/storytelling-framework";
import type { ContentTemplate, OverlayStyle, TemplateRenderResponse } from "@/types/templates";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    projectId,
    templateId,
    platform = "instagram_feed",
    campaignId: inputCampaignId,
    modelTier = "nb2",
    customInstruction,
    slides: slideInputs,
    brandOverrides,
    referenceImage, // optional: { base64: string; mimeType: string }
  } = body;

  if (!projectId || !templateId || !slideInputs?.length) {
    return NextResponse.json(
      { error: "projectId, templateId, and slides are required" },
      { status: 400 }
    );
  }

  // Verify project ownership
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // ─── Load Template ───────────────────────────────────────────────────────

  let template: ContentTemplate | undefined = findSystemTemplate(templateId);

  if (!template) {
    // Try DB
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
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // ─── Load Brand Context ──────────────────────────────────────────────────

  const [brandContext, brandTokens] = await Promise.all([
    loadBrandContext(supabase, projectId),
    loadBrandTokens(supabase, projectId, brandOverrides),
  ]);

  const dims = getPlatformDimensions(platform);

  // ─── Gemini Setup ────────────────────────────────────────────────────────

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_AI_API_KEY not configured" }, { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-image-preview" });

  // Service Supabase for storage uploads (bypass RLS)
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ─── Create Campaign ─────────────────────────────────────────────────────

  let campaignId = inputCampaignId;
  if (!campaignId) {
    const { data: campaign } = await supabase
      .from("campaigns")
      .insert({
        project_id: projectId,
        user_id: user.id,
        name: `${template.name} — ${new Date().toLocaleDateString()}`,
        campaign_type: "social_media",
        platforms: [platform.split("_")[0]],
        status: "draft",
      })
      .select()
      .single();
    campaignId = (campaign as { id: string } | null)?.id;
  }

  if (!campaignId) {
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }

  // ─── Generate carousel group ID for multi-slide templates ────────────────

  const isCarousel = template.format === "carousel" && template.slides.length > 1;
  const carouselGroupId = isCarousel ? crypto.randomUUID() : null;

  // ─── Process Each Slide ──────────────────────────────────────────────────

  const results: Array<{ slideId: string; imageUrl: string; assetId: string }> = [];

  for (let i = 0; i < slideInputs.length; i++) {
    const slideInput = slideInputs[i];
    const slideDef = template.slides.find((s) => s.id === slideInput.slideId);
    if (!slideDef) continue;

    const fieldValues = slideInput.fieldValues || {};

    // 1. Build AI background prompt
    const contentSummary = Object.values(fieldValues).filter(Boolean).join(" — ");
    const { prompt, negativePrompt } = buildImagePrompt({
      postContent: contentSummary,
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
      customInstruction: [customInstruction, slideDef.aiPromptHint].filter(Boolean).join(". "),
    });

    // 2. Generate background image via Gemini
    let imageBase64: string;
    let mimeType: string;

    try {
      // Build parts array — reference image first (if provided), then text prompt
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
        return NextResponse.json(
          { error: `No image returned for slide: ${slideDef.name}` },
          { status: 500 }
        );
      }

      // @ts-ignore
      imageBase64 = imagePart.inlineData.data;
      // @ts-ignore
      mimeType = imagePart.inlineData.mimeType ?? "image/png";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Image generation failed";
      return NextResponse.json({ error: `Slide "${slideDef.name}": ${msg}` }, { status: 500 });
    }

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

    // 5. Upload to Supabase Storage
    const fileName = `${user.id}/${projectId}/${Date.now()}-${template.id}-${slideDef.id}.png`;
    const { error: uploadError } = await serviceSupabase.storage
      .from("generated-images")
      .upload(fileName, finalImage, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = serviceSupabase.storage
      .from("generated-images")
      .getPublicUrl(fileName);

    // 6. Save as campaign asset
    const { data: asset, error: assetError } = await supabase
      .from("campaign_assets")
      .insert({
        campaign_id: campaignId,
        user_id: user.id,
        asset_type: "template_render",
        title: `${template.name} — ${slideDef.name}`,
        content: contentSummary || slideDef.name,
        storage_path: urlData.publicUrl,
        carousel_group_id: carouselGroupId,
        slide_order: i,
        metadata: {
          template_id: template.id,
          slide_id: slideDef.id,
          platform,
          aspect_ratio: dims.aspectRatio,
          model_tier: modelTier,
          overlay_style: slideDef.overlayStyle,
          mime_type: "image/png",
          file_name: fileName,
        },
        status: "draft",
      })
      .select()
      .single();

    if (assetError) {
      return NextResponse.json({ error: assetError.message }, { status: 500 });
    }

    results.push({
      slideId: slideDef.id,
      imageUrl: urlData.publicUrl,
      assetId: (asset as { id: string }).id,
    });
  }

  // ─── Generate Caption + Hashtags ─────────────────────────────────────────

  let generatedCaption = "";
  let generatedHashtags: string[] = [];

  try {
    const allContent = slideInputs
      .map((s: { fieldValues?: Record<string, string> }) =>
        Object.values(s.fieldValues || {}).filter(Boolean).join(" — ")
      )
      .filter(Boolean)
      .join("\n");

    const platformLabel = platform.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    const textModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const captionResult = await textModel.generateContent(
      `You are an expert social media copywriter. Write a single high-performing caption and hashtags for a ${platformLabel} post.

BRAND CONTEXT:
- Personality: ${brandContext.brandPersonality || "professional and engaging"}
- Positioning: ${brandContext.brandPositioning || ""}
- Product: ${brandContext.productContext || ""}
- Audience: ${brandContext.audienceContext || ""}

POST CONCEPT:
${allContent}

${getCondensedStorytellingGuidance()}

PLATFORM: ${platformLabel}

OUTPUT FORMAT (follow exactly):
CAPTION: [your caption — ready to publish, no quotes]
HASHTAGS: [comma-separated hashtags without # prefix]

Rules:
- Caption must be platform-appropriate in length and tone
- Use the brand voice from the context above
- Do not repeat the post concept verbatim — rewrite it as engaging copy
- Include 5-10 relevant hashtags
- No intro text, no explanations — just CAPTION and HASHTAGS`
    );

    const captionText = captionResult.response.text().trim();
    const captionMatch = captionText.match(/CAPTION:\s*([\s\S]*?)(?=HASHTAGS:|$)/i);
    const hashtagsMatch = captionText.match(/HASHTAGS:\s*([\s\S]*?)$/i);

    if (captionMatch?.[1]) {
      generatedCaption = captionMatch[1].trim();
    }
    if (hashtagsMatch?.[1]) {
      generatedHashtags = hashtagsMatch[1]
        .trim()
        .split(/[,\n]+/)
        .map((h) => h.trim().replace(/^#/, ""))
        .filter(Boolean);
    }
  } catch {
    // Caption generation is best-effort
  }

  // Update the first asset with caption + hashtags in metadata
  if ((generatedCaption || generatedHashtags.length > 0) && results.length > 0) {
    const firstAssetId = results[0].assetId;
    await supabase
      .from("campaign_assets")
      .update({
        metadata: {
          ...(await supabase
            .from("campaign_assets")
            .select("metadata")
            .eq("id", firstAssetId)
            .single()
            .then((r) => (r.data?.metadata as Record<string, unknown>) || {})),
          ...(generatedCaption && { caption: generatedCaption }),
          ...(generatedHashtags.length > 0 && { hashtags: generatedHashtags }),
        },
      })
      .eq("id", firstAssetId);
  }

  // ─── Return Response ─────────────────────────────────────────────────────

  const response: TemplateRenderResponse = {
    campaignId,
    templateId: template.id,
    platform,
    slides: results,
  };

  return NextResponse.json(response);
}
