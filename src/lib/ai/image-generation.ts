import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI, { toFile } from "openai";

export type ImageProvider = "openai" | "gemini";

export interface ReferenceImageInput {
  base64: string;
  mimeType: string;
}

export interface GeneratedImageResult {
  base64: string;
  mimeType: string;
  provider: ImageProvider;
  model: string;
}

export interface GenerateMarketingImageInput {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  referenceImage?: ReferenceImageInput;
  preferredProvider?: ImageProvider;
}

function getPreferredProvider(explicit?: ImageProvider): ImageProvider {
  if (explicit) return explicit;
  const configured = process.env.IMAGE_PROVIDER?.toLowerCase();
  return configured === "gemini" ? "gemini" : "openai";
}

function openAIImageSize(aspectRatio?: string): "1024x1024" | "1536x1024" | "1024x1536" {
  const ratio = aspectRatio?.trim();
  if (!ratio) return "1024x1024";

  const [w, h] = ratio.split(":").map((part) => Number(part));
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return "1024x1024";

  const numericRatio = w / h;
  if (numericRatio > 1.2) return "1536x1024";
  if (numericRatio < 0.85) return "1024x1536";
  return "1024x1024";
}

function openAIPrompt(input: GenerateMarketingImageInput): string {
  const lines = [input.prompt];
  if (input.negativePrompt) {
    lines.push("", `Avoid: ${input.negativePrompt}`);
  }
  lines.push(
    "",
    "Render a polished, conversion-focused social media marketing image.",
    "Do not place readable text inside the generated image; MarketPilot adds localized text overlays separately."
  );
  return lines.join("\n");
}

async function generateWithOpenAI(input: GenerateMarketingImageInput): Promise<GeneratedImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const prompt = openAIPrompt(input);
  const size = openAIImageSize(input.aspectRatio);

  if (input.referenceImage?.base64) {
    const imageBuffer = Buffer.from(input.referenceImage.base64, "base64");
    const ext = input.referenceImage.mimeType.includes("jpeg") ? "jpg" : "png";
    const imageFile = await toFile(imageBuffer, `reference.${ext}`, {
      type: input.referenceImage.mimeType,
    });

    const result = await client.images.edit({
      model,
      image: imageFile,
      prompt,
      size,
      quality: "high",
    });

    const base64 = result.data?.[0]?.b64_json;
    if (!base64) throw new Error("OpenAI image edit returned no image data");

    return { base64, mimeType: "image/png", provider: "openai", model };
  }

  const result = await client.images.generate({
    model,
    prompt,
    size,
    quality: "high",
  });

  const base64 = result.data?.[0]?.b64_json;
  if (!base64) throw new Error("OpenAI image generation returned no image data");

  return { base64, mimeType: "image/png", provider: "openai", model };
}

async function generateWithGemini(input: GenerateMarketingImageInput): Promise<GeneratedImageResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

  const model = "gemini-3.1-flash-image-preview";
  const genAI = new GoogleGenerativeAI(apiKey);
  const imageModel = genAI.getGenerativeModel({ model });

  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];
  if (input.referenceImage?.base64) {
    parts.push({
      inlineData: {
        data: input.referenceImage.base64,
        mimeType: input.referenceImage.mimeType,
      },
    });
  }
  parts.push({ text: `${input.prompt}\n\nAvoid: ${input.negativePrompt || "low quality, blurry, distorted"}` });

  const result = await imageModel.generateContent({
    contents: [{ role: "user", parts }],
    generationConfig: {
      // The current @google/generative-ai type definitions lag Gemini image models.
      // @ts-expect-error responseModalities is required for image output.
      responseModalities: ["IMAGE", "TEXT"],
    },
  });

  const responseParts = result.response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = responseParts.find((part) =>
    "inlineData" in part && part.inlineData?.mimeType?.startsWith("image/")
  );

  if (!imagePart || !("inlineData" in imagePart) || !imagePart.inlineData?.data) {
    throw new Error("Gemini image generation returned no image data");
  }

  return {
    base64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType ?? "image/png",
    provider: "gemini",
    model,
  };
}

export async function generateMarketingImage(
  input: GenerateMarketingImageInput
): Promise<GeneratedImageResult> {
  const provider = getPreferredProvider(input.preferredProvider);

  if (provider === "openai") {
    try {
      return await generateWithOpenAI(input);
    } catch (err) {
      if (!process.env.GOOGLE_AI_API_KEY) throw err;
      console.warn("OpenAI image generation failed; falling back to Gemini", err);
      return generateWithGemini(input);
    }
  }

  try {
    return await generateWithGemini(input);
  } catch (err) {
    if (!process.env.OPENAI_API_KEY) throw err;
    console.warn("Gemini image generation failed; falling back to OpenAI", err);
    return generateWithOpenAI(input);
  }
}
