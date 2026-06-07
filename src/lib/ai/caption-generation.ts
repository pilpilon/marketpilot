import OpenAI from "openai";
import { getCondensedStorytellingGuidance } from "@/lib/ai/storytelling-framework";

type CaptionBrandContext = {
  brandPersonality?: string;
  brandPositioning?: string;
  productContext?: string;
  audienceContext?: string;
  features?: string;
};

export interface GenerateSocialCaptionParams {
  brandContext: CaptionBrandContext;
  postConcept: string;
  platform: string;
  headline?: string;
  localeContext?: string;
  captionLength?: "short" | "standard" | "long";
}

export interface SocialCaptionResult {
  caption: string;
  hashtags: string[];
}

function cleanEnvValue(value: string | undefined): string | undefined {
  const cleaned = value?.trim().replace(/(?:\\r|\\n)+$/g, "").trim();
  return cleaned || undefined;
}

function platformLabel(platform: string): string {
  return platform.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function lengthGuidance(length: GenerateSocialCaptionParams["captionLength"], platform: string): string {
  if (length === "short") return "Write 2-4 concise lines.";
  if (length === "long") return "Write a substantial caption: 100-160 words for Facebook/LinkedIn, or 70-120 words for Instagram. Use paragraph breaks.";
  if (platform.includes("facebook") || platform.includes("linkedin")) {
    return "Write a useful B2B caption: 80-140 words with paragraph breaks.";
  }
  return "Write a strong platform-native caption: 50-100 words with paragraph breaks.";
}

function inferLanguage(localeContext?: string): string {
  const ctx = localeContext?.toLowerCase() || "";
  if (ctx.includes("hebrew") || ctx.includes("עברית") || ctx.includes("he")) return "Hebrew";
  return "the same language requested by the locale/context; default to English only if no locale is provided";
}

function parseCaptionResponse(text: string): SocialCaptionResult {
  const captionMatch = text.match(/CAPTION:\s*([\s\S]*?)(?=HASHTAGS:|$)/i);
  const hashtagsMatch = text.match(/HASHTAGS:\s*([\s\S]*?)$/i);
  const caption = captionMatch?.[1]?.trim() || text.trim();
  const hashtags = hashtagsMatch?.[1]
    ? hashtagsMatch[1]
        .trim()
        .split(/[,\n]+/)
        .map((h) => h.trim().replace(/^#/, ""))
        .filter(Boolean)
    : [];

  return { caption, hashtags };
}

export async function generateSocialCaption(params: GenerateSocialCaptionParams): Promise<SocialCaptionResult> {
  const apiKey = cleanEnvValue(process.env.OPENAI_API_KEY);
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured for caption generation");

  const { brandContext, postConcept, platform, headline, localeContext, captionLength } = params;
  const client = new OpenAI({ apiKey });
  const textModel = cleanEnvValue(process.env.OPENAI_TEXT_MODEL) || cleanEnvValue(process.env.CHAT_MODEL) || "gpt-4o-mini";
  const featuresGuard = brandContext.features
    ? `\nCONFIRMED PRODUCT CAPABILITIES — use ONLY these, do not invent features:\n${brandContext.features.slice(0, 1400)}\n`
    : "";
  const language = inferLanguage(localeContext);

  const result = await client.chat.completions.create({
    model: textModel,
    messages: [
      {
        role: "system",
        content: "You are a senior performance social media copywriter. Return exactly CAPTION and HASHTAGS sections, no explanation.",
      },
      {
        role: "user",
        content: `Write a conversion-focused caption and hashtags for a ${platformLabel(platform)} post.

BRAND CONTEXT:
- Personality: ${brandContext.brandPersonality || "clear, practical, confident"}
- Positioning: ${brandContext.brandPositioning || ""}
- Product: ${brandContext.productContext || ""}
- Audience: ${brandContext.audienceContext || ""}
${featuresGuard}
POST HOOK / HEADLINE:
${headline || ""}

POST CONCEPT:
${postConcept}

${getCondensedStorytellingGuidance()}

PLATFORM: ${platformLabel(platform)}
LANGUAGE: Write the full caption in ${language}. Hashtags may include brand/product terms if useful.
${localeContext ? `\nLOCALE / STYLE CONTEXT:\n${localeContext}\n` : ""}
LENGTH:
${lengthGuidance(captionLength, platform)}

OUTPUT FORMAT — follow exactly:
CAPTION: [ready-to-publish caption, no quotes]
HASHTAGS: [comma-separated hashtags without # prefix]

Rules:
- Start with a strong hook, not a generic intro.
- Be specific to the business, audience pain, and product value.
- For B2B/local business content, use: pain → consequence → product mechanism → concrete benefit → CTA.
- For restaurant/inventory software, prefer concrete pains like supplier chaos, invoice/OCR review, stock-count mistakes, min-stock/reorder confusion, manual spreadsheets, and wasted manager time when supported by the concept/context.
- Do not write one-sentence captions unless explicitly asked for short.
- Do not repeat the visual headline verbatim; expand it.
- Include a clear CTA.
- Include 5-10 relevant hashtags.
- Do NOT invent product capabilities, metrics, customers, integrations, or guarantees.
- CONTENT SAFETY: no religious symbols, national flags, political topics, military imagery, or culturally controversial subjects.
- No intro text, no explanations — just CAPTION and HASHTAGS.`,
      },
    ],
    temperature: 0.7,
  });

  return parseCaptionResponse(result.choices[0]?.message?.content?.trim() || "");
}
