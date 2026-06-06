import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadBrandContext } from "@/lib/templates/brand-tokens";
import { generateCreativeImage } from "@/lib/skills/creative-designer";
import { PLATFORM_RATIOS } from "@/lib/templates/dimensions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildImagePrompt } from "@/lib/templates/prompt-builder";
import { getCondensedStorytellingGuidance } from "@/lib/ai/storytelling-framework";
import { screenshotToReferenceImage } from "@/lib/screenshots/mockup";
import { generateMarketingImage } from "@/lib/ai/image-generation";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    projectId,
    campaignId,
    postContent,
    platform = "instagram_feed",
    aspectRatio,
    customInstruction,
    modelTier = "nb2",
    referenceImage,
  } = await request.json();

  if (!projectId || !postContent) {
    return NextResponse.json(
      { error: "projectId and postContent are required" },
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

  // Load brand intelligence
  const brandContext = await loadBrandContext(supabase, projectId);

  // Auto-inject approved project screenshot as reference image when user hasn't provided one
  let effectiveReferenceImage = referenceImage;
  let isAutoScreenshot = false;

  if (!effectiveReferenceImage?.base64) {
    try {
      const { data: screenshots } = await supabase
        .from("project_screenshots")
        .select("public_url, viewport, screenshot_type")
        .eq("project_id", projectId)
        .eq("approved", true)
        .order("screenshot_type", { ascending: false }) // "product" before "landing"
        .order("viewport", { ascending: true }) // mobile first
        .limit(1);

      if (screenshots?.length) {
        const screenshotRes = await fetch((screenshots[0] as { public_url: string }).public_url, {
          signal: AbortSignal.timeout(5000),
        });
        if (screenshotRes.ok) {
          const buf = Buffer.from(await screenshotRes.arrayBuffer());
          const device = (screenshots[0] as { viewport: string }).viewport === "mobile" ? "iphone" as const : "browser" as const;
          const ref = await screenshotToReferenceImage(buf, device);
          effectiveReferenceImage = { base64: ref.base64, mimeType: ref.mimeType };
          isAutoScreenshot = true;
        }
      }
    } catch {
      // Best-effort — continue without screenshot
    }
  }

  // If there's a reference image (user-provided or auto-screenshot), use the direct Gemini path
  if (effectiveReferenceImage?.base64) {
    return handleReferenceImageGeneration({
      supabase,
      userId: user.id,
      projectId,
      campaignId,
      postContent,
      platform,
      aspectRatio,
      customInstruction,
      modelTier,
      referenceImage: effectiveReferenceImage,
      brandContext,
      isAutoScreenshot,
    });
  }

  // Create campaign if not provided
  let finalCampaignId = campaignId;
  if (!finalCampaignId) {
    const { data: campaign } = await supabase
      .from("campaigns")
      .insert({
        project_id: projectId,
        user_id: user.id,
        name: `Creative Design — ${platform} — ${new Date().toLocaleDateString()}`,
        campaign_type: "social_media",
        platforms: [platform.split("_")[0]],
        status: "draft",
      })
      .select()
      .single();
    finalCampaignId = (campaign as { id: string } | null)?.id;
  }

  if (!finalCampaignId) {
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }

  try {
    const result = await generateCreativeImage({
      supabase,
      userId: user.id,
      projectId,
      campaignId: finalCampaignId,
      postContent,
      platform,
      brandContext,
      customInstruction,
    });

    return NextResponse.json({
      asset: { id: result.assetId },
      imageUrl: result.imageUrl,
      campaignId: finalCampaignId,
      prompt: postContent,
      aspectRatio: aspectRatio || PLATFORM_RATIOS[platform] || "1:1",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Image generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Handle generation with a reference image — requires direct Gemini call
 * since the shared function doesn't support inline reference images.
 */
async function handleReferenceImageGeneration(params: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  campaignId?: string;
  postContent: string;
  platform: string;
  aspectRatio?: string;
  customInstruction?: string;
  modelTier: string;
  referenceImage: { base64: string; mimeType: string };
  brandContext: Awaited<ReturnType<typeof loadBrandContext>>;
  isAutoScreenshot?: boolean;
}) {
  const {
    supabase,
    userId,
    projectId,
    postContent,
    platform,
    aspectRatio,
    customInstruction,
    referenceImage,
    brandContext,
  } = params;

  const ratio = aspectRatio || PLATFORM_RATIOS[platform] || "1:1";

  const { prompt, negativePrompt } = buildImagePrompt({
    postContent,
    platform,
    styleKeywords: brandContext.visual.styleKeywords,
    colorPalette: brandContext.visual.colorPalette,
    visualDonts: brandContext.visual.visualDonts,
    brandPersonality: brandContext.brandPersonality,
    audienceContext: brandContext.audienceContext,
    brandPositioning: brandContext.brandPositioning,
    productContext: brandContext.productContext,
    intakePatterns: brandContext.intakePatterns,
    hasReferenceImage: true,
    isAutoScreenshot: params.isAutoScreenshot,
    platformTypes: brandContext.platformTypes,
    customInstruction,
  });

  let imageBase64: string;
  let mimeType: string;
  let generatedImage: Awaited<ReturnType<typeof generateMarketingImage>>;

  try {
    generatedImage = await generateMarketingImage({
      prompt,
      negativePrompt,
      aspectRatio: ratio,
      referenceImage,
    });
    imageBase64 = generatedImage.base64;
    mimeType = generatedImage.mimeType;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Image generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Upload to Supabase Storage
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const ext = mimeType === "image/jpeg" ? "jpg" : "png";
  const fileName = `${userId}/${projectId}/${Date.now()}-${platform}.${ext}`;
  const imageBuffer = Buffer.from(imageBase64, "base64");

  const { error: uploadError } = await serviceSupabase.storage
    .from("generated-images")
    .upload(fileName, imageBuffer, { contentType: mimeType, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = serviceSupabase.storage
    .from("generated-images")
    .getPublicUrl(fileName);

  const publicUrl = urlData.publicUrl;

  // Generate caption + hashtags
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_AI_API_KEY not configured for caption generation" }, { status: 500 });
  const genAI = new GoogleGenerativeAI(apiKey);
  const platformLabel = platform.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  let generatedCaption = "";
  let generatedHashtags: string[] = [];

  try {
    const textModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const featuresGuard = brandContext.features
      ? `\nPRODUCT CAPABILITIES (ONLY reference these — do NOT invent features):\n${brandContext.features.slice(0, 1000)}\n\nRULES:\n- Only mention features listed as "Confirmed" above\n- Do NOT promise features not in the list\n- If the product is a website (not a mobile app), do NOT suggest "download the app" or reference app stores`
      : "";

    const captionResult = await textModel.generateContent(
      `You are an expert social media copywriter. Write a single high-performing caption and hashtags for a ${platformLabel} post.

BRAND CONTEXT:
- Personality: ${brandContext.brandPersonality || "professional and engaging"}
- Positioning: ${brandContext.brandPositioning || ""}
- Product: ${brandContext.productContext || ""}
- Audience: ${brandContext.audienceContext || ""}
${featuresGuard}

POST CONCEPT:
${postContent}

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
- No intro text, no explanations — just CAPTION and HASHTAGS
- CONTENT SAFETY: Do NOT reference religious symbols, national flags, political topics, military imagery, or culturally controversial subjects. Keep copy culturally neutral and brand-focused.`
    );

    const captionText = captionResult.response.text().trim();
    const captionMatch = captionText.match(/CAPTION:\s*([\s\S]*?)(?=HASHTAGS:|$)/i);
    const hashtagsMatch = captionText.match(/HASHTAGS:\s*([\s\S]*?)$/i);

    if (captionMatch?.[1]) generatedCaption = captionMatch[1].trim();
    if (hashtagsMatch?.[1]) {
      generatedHashtags = hashtagsMatch[1].trim().split(/[,\n]+/).map((h) => h.trim().replace(/^#/, "")).filter(Boolean);
    }
  } catch {
    // Best-effort
  }

  // Create campaign if needed
  let finalCampaignId = params.campaignId;
  if (!finalCampaignId) {
    const { data: campaign } = await supabase
      .from("campaigns")
      .insert({
        project_id: projectId,
        user_id: userId,
        name: `Creative Design — ${platform} — ${new Date().toLocaleDateString()}`,
        campaign_type: "social_media",
        platforms: [platform.split("_")[0]],
        status: "draft",
      })
      .select()
      .single();
    finalCampaignId = campaign?.id;
  }

  // Save asset
  const { data: asset, error: assetError } = await supabase
    .from("campaign_assets")
    .insert({
      campaign_id: finalCampaignId,
      user_id: userId,
      asset_type: "image",
      title: `${platform} visual`,
      content: postContent,
      storage_path: publicUrl,
      metadata: {
        platform,
        aspect_ratio: ratio,
        provider: generatedImage.provider,
        model: generatedImage.model,
        mime_type: mimeType,
        file_name: fileName,
        ...(generatedCaption && { caption: generatedCaption }),
        ...(generatedHashtags.length > 0 && { hashtags: generatedHashtags }),
      },
      status: "draft",
    })
    .select()
    .single();

  if (assetError) return NextResponse.json({ error: assetError.message }, { status: 500 });

  return NextResponse.json({
    asset,
    imageUrl: publicUrl,
    campaignId: finalCampaignId,
    prompt,
    aspectRatio: ratio,
  });
}
