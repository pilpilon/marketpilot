import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { loadBrandContext } from "@/lib/templates/brand-tokens";
import { PLATFORM_RATIOS } from "@/lib/templates/dimensions";
import { renderTemplateImage } from "@/lib/templates/render-template-image";
import { findSystemTemplate } from "@/lib/templates/system-templates";
import { generateSocialCaption } from "@/lib/ai/caption-generation";
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

  const results: Array<{ slideId: string; imageUrl: string; assetId: string; provider: string; model: string }> = [];

  for (let i = 0; i < rendered.length; i++) {
    const { slideId, imageBuffer, provider, model } = rendered[i];

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
          aspect_ratio: PLATFORM_RATIOS[platform] || "1:1",
          model_tier: modelTier,
          provider,
          model,
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
      provider,
      model,
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

    const captionResult = await generateSocialCaption({
      brandContext,
      postConcept: allContent,
      platform,
      captionLength: "standard",
    });
    generatedCaption = captionResult.caption;
    generatedHashtags = captionResult.hashtags;
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
