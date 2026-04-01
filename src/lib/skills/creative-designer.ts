import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PLATFORM_RATIOS } from "@/lib/templates/dimensions";
import { loadBrandContext } from "@/lib/templates/brand-tokens";
import { buildImagePrompt } from "@/lib/templates/prompt-builder";
import { getCondensedStorytellingGuidance } from "@/lib/ai/storytelling-framework";

export type BrandContext = Awaited<ReturnType<typeof loadBrandContext>>;

export interface GenerateCreativeImageParams {
  supabase: SupabaseClient<any, any, any>;
  userId: string;
  projectId: string;
  campaignId: string;
  postContent: string;
  platform: string; // e.g. "instagram_feed"
  brandContext: BrandContext;
  customInstruction?: string;
}

export interface GenerateCreativeImageResult {
  assetId: string;
  imageUrl: string;
  caption: string;
  hashtags: string[];
}

/**
 * Core image generation logic extracted from the Creative Designer route.
 * Generates an image, uploads to storage, creates caption + hashtags, saves as campaign asset.
 */
export async function generateCreativeImage(
  params: GenerateCreativeImageParams
): Promise<GenerateCreativeImageResult> {
  const {
    supabase,
    userId,
    projectId,
    campaignId,
    postContent,
    platform,
    brandContext,
    customInstruction,
  } = params;

  const ratio = PLATFORM_RATIOS[platform] || "1:1";

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
    hasReferenceImage: false,
    customInstruction,
  });

  // Generate image with Gemini 3.1 Flash Image
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const imageModel = genAI.getGenerativeModel({ model: "gemini-3.1-flash-image-preview" });

  const result = await imageModel.generateContent({
    contents: [{ role: "user", parts: [{ text: `${prompt}\n\nAvoid: ${negativePrompt}` }] }],
    generationConfig: {
      // @ts-ignore — responseModalities is supported but not in older type defs
      responseModalities: ["IMAGE", "TEXT"],
    },
  });

  const parts = result.response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find(
    // @ts-ignore
    (p) => p.inlineData?.mimeType?.startsWith("image/")
  );

  if (!imagePart || !("inlineData" in imagePart)) {
    throw new Error("No image was returned by the model");
  }

  // @ts-ignore
  const imageBase64: string = imagePart.inlineData.data;
  // @ts-ignore
  const mimeType: string = imagePart.inlineData.mimeType ?? "image/png";

  // Upload to Supabase Storage using service role
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

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

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

  // Save as campaign asset
  const { data: asset, error: assetError } = await supabase
    .from("campaign_assets")
    .insert({
      campaign_id: campaignId,
      user_id: userId,
      asset_type: "image",
      title: `${platform} visual`,
      content: postContent,
      storage_path: publicUrl,
      metadata: {
        platform,
        aspect_ratio: ratio,
        model_tier: "nb2",
        mime_type: mimeType,
        file_name: fileName,
        ...(generatedCaption && { caption: generatedCaption }),
        ...(generatedHashtags.length > 0 && { hashtags: generatedHashtags }),
      },
      status: "draft",
    })
    .select()
    .single();

  if (assetError) throw new Error(`Asset creation failed: ${assetError.message}`);

  return {
    assetId: (asset as { id: string }).id,
    imageUrl: publicUrl,
    caption: generatedCaption,
    hashtags: generatedHashtags,
  };
}
