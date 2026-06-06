import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PLATFORM_RATIOS } from "@/lib/templates/dimensions";
import { loadBrandContext } from "@/lib/templates/brand-tokens";
import { buildImagePrompt } from "@/lib/templates/prompt-builder";
import { generateMarketingImage } from "@/lib/ai/image-generation";
import { generateSocialCaption } from "@/lib/ai/caption-generation";

export type BrandContext = Awaited<ReturnType<typeof loadBrandContext>>;

export interface GenerateCreativeImageParams {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  campaignId: string;
  postContent: string;
  platform: string; // e.g. "instagram_feed"
  brandContext: BrandContext;
  customInstruction?: string;
  /** Locale context string (e.g. "Write in Hebrew", posting times, etc.) */
  localeContext?: string;
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
    localeContext,
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

  // Generate the visual. OpenAI is the default when IMAGE_PROVIDER=openai;
  // Gemini remains available as an automatic fallback.
  const generatedImage = await generateMarketingImage({
    prompt,
    negativePrompt,
    aspectRatio: ratio,
  });

  const imageBase64 = generatedImage.base64;
  const mimeType = generatedImage.mimeType;

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

  let generatedCaption = "";
  let generatedHashtags: string[] = [];

  try {
    const captionResult = await generateSocialCaption({
      brandContext,
      postConcept: postContent,
      platform,
      localeContext,
      captionLength: "standard",
    });
    generatedCaption = captionResult.caption;
    generatedHashtags = captionResult.hashtags;
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

  if (assetError) throw new Error(`Asset creation failed: ${assetError.message}`);

  return {
    assetId: (asset as { id: string }).id,
    imageUrl: publicUrl,
    caption: generatedCaption,
    hashtags: generatedHashtags,
  };
}
