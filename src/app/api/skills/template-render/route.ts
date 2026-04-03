import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { loadBrandContext } from "@/lib/templates/brand-tokens";
import { renderTemplateImage } from "@/lib/templates/render-template-image";
import { findSystemTemplate } from "@/lib/templates/system-templates";
import { getCondensedStorytellingGuidance } from "@/lib/ai/storytelling-framework";
import type { TemplateRenderResponse } from "@/types/templates";

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
    referenceImage,
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

  // ─── Create Campaign ─────────────────────────────────────────────────────

  const template = findSystemTemplate(templateId);

  let campaignId = inputCampaignId;
  if (!campaignId) {
    const { data: campaign } = await supabase
      .from("campaigns")
      .insert({
        project_id: projectId,
        user_id: user.id,
        name: `${template?.name || "Template"} — ${new Date().toLocaleDateString()}`,
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

  // ─── Render Template Images ─────────────────────────────────────────────

  let rendered;
  try {
    rendered = await renderTemplateImage({
      supabase,
      projectId,
      templateId,
      platform,
      slides: slideInputs.map((s: { slideId: string; fieldValues?: Record<string, string> }) => ({
        slideId: s.slideId,
        fieldValues: s.fieldValues || {},
      })),
      brandOverrides,
      customInstruction,
      referenceImage,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Template rendering failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // ─── Upload + Save Assets ───────────────────────────────────────────────

  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const resolvedTemplate = findSystemTemplate(templateId);
  const isCarousel = (resolvedTemplate?.format === "carousel" && (resolvedTemplate?.slides.length ?? 0) > 1);
  const carouselGroupId = isCarousel ? crypto.randomUUID() : null;

  const results: Array<{ slideId: string; imageUrl: string; assetId: string }> = [];

  for (let i = 0; i < rendered.length; i++) {
    const { slideId, imageBuffer } = rendered[i];

    const fileName = `${user.id}/${projectId}/${Date.now()}-${templateId}-${slideId}.jpg`;
    const { error: uploadError } = await serviceSupabase.storage
      .from("generated-images")
      .upload(fileName, imageBuffer, { contentType: "image/jpeg", upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = serviceSupabase.storage
      .from("generated-images")
      .getPublicUrl(fileName);

    const slideDef = resolvedTemplate?.slides.find((s) => s.id === slideId);
    const contentSummary = slideInputs[i]?.fieldValues
      ? Object.values(slideInputs[i].fieldValues).filter(Boolean).join(" — ")
      : slideId;

    const { data: asset, error: assetError } = await supabase
      .from("campaign_assets")
      .insert({
        campaign_id: campaignId,
        user_id: user.id,
        asset_type: "template_render",
        title: `${resolvedTemplate?.name || "Template"} — ${slideDef?.name || slideId}`,
        content: contentSummary,
        storage_path: urlData.publicUrl,
        carousel_group_id: carouselGroupId,
        slide_order: i,
        metadata: {
          template_id: templateId,
          slide_id: slideId,
          platform,
          aspect_ratio: resolvedTemplate ? undefined : undefined,
          model_tier: modelTier,
          overlay_style: slideDef?.overlayStyle,
          mime_type: "image/jpeg",
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
      slideId,
      imageUrl: urlData.publicUrl,
      assetId: (asset as { id: string }).id,
    });
  }

  // ─── Generate Caption + Hashtags ────────────────────────────────────────

  let generatedCaption = "";
  let generatedHashtags: string[] = [];

  try {
    const brandContext = await loadBrandContext(supabase, projectId);
    const allContent = slideInputs
      .map((s: { fieldValues?: Record<string, string> }) =>
        Object.values(s.fieldValues || {}).filter(Boolean).join(" — ")
      )
      .filter(Boolean)
      .join("\n");

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
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

      if (captionMatch?.[1]) generatedCaption = captionMatch[1].trim();
      if (hashtagsMatch?.[1]) {
        generatedHashtags = hashtagsMatch[1]
          .trim()
          .split(/[,\n]+/)
          .map((h) => h.trim().replace(/^#/, ""))
          .filter(Boolean);
      }
    }
  } catch {
    // Caption generation is best-effort
  }

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

  // ─── Return Response ────────────────────────────────────────────────────

  const response: TemplateRenderResponse = {
    campaignId,
    templateId,
    platform,
    slides: results,
  };

  return NextResponse.json(response);
}
