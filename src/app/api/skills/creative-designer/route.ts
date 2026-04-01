import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadBrandContext } from "@/lib/templates/brand-tokens";
import { generateCreativeImage } from "@/lib/skills/creative-designer";
import { PLATFORM_RATIOS } from "@/lib/templates/dimensions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { buildImagePrompt } from "@/lib/templates/prompt-builder";
import { getCondensedStorytellingGuidance } from "@/lib/ai/storytelling-framework";

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

  // If there's a reference image, use the direct Gemini path (can't go through shared fn)
  if (referenceImage?.base64) {
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
      referenceImage,
      brandContext,
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
  supabase: any;
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
    customInstruction,
  });

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_AI_API_KEY not configured" }, { status: 500 });

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-image-preview" });

  let imageBase64: string;
  let mimeType: string;

  try {
    const reqParts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
    reqParts.push({ inlineData: { data: referenceImage.base64, mimeType: referenceImage.mimeType } });
    reqParts.push({ text: `${prompt}\n\nAvoid: ${negativePrompt}` });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: reqParts }],
      generationConfig: {
        // @ts-ignore
        responseModalities: ["IMAGE", "TEXT"],
      },
    });

    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(
      // @ts-ignore
      (p) => p.inlineData?.mimeType?.startsWith("image/")
    );

    if (!imagePart || !("inlineData" in imagePart)) {
      return NextResponse.json({ error: "No image was returned by the model" }, { status: 500 });
    }

    // @ts-ignore
    imageBase64 = imagePart.inlineData.data;
    // @ts-ignore
    mimeType = imagePart.inlineData.mimeType ?? "image/png";
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
  const platformLabel = platform.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  let generatedCaption = "";
  let generatedHashtags: string[] = [];

  try {
    const textModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const captionResult = await textModel.generateContent(
      `You are an expert social media copywriter. Write a single high-performing caption and hashtags for a ${platformLabel} post.

BRAND CONTEXT:
- Personality: ${brandContext.brandPersonality || "professional and engaging"}
- Positioning: ${brandContext.brandPositioning || ""}
- Product: ${brandContext.productContext || ""}
- Audience: ${brandContext.audienceContext || ""}

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
- No intro text, no explanations — just CAPTION and HASHTAGS`
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
    const { data: campaign } = await (supabase as any)
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
  const { data: asset, error: assetError } = await (supabase as any)
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
        model_tier: params.modelTier,
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
