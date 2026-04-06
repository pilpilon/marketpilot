/**
 * Video script generator — transforms brand intelligence into a structured
 * multi-scene video script via Gemini 2.5 Flash.
 *
 * Output is deterministic JSON, validated with Zod, so the scene generator,
 * composer, and UI all work off a consistent contract.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import type { loadBrandContext } from "@/lib/templates/brand-tokens";
import type {
  VideoFramework,
  VideoLanguage,
  VideoScript,
  MusicMood,
} from "./types";
import { inferMoodFromBrand } from "./music-library";

type BrandContext = Awaited<ReturnType<typeof loadBrandContext>>;

const SCENE_DURATION_SECONDS = 8;

const scriptSchema = z.object({
  hook: z.string().min(1).max(120),
  keyMessage: z.string().min(1).max(160),
  cta: z.string().min(1).max(80),
  scenes: z
    .array(
      z.object({
        prompt: z.string().min(10).max(1200),
        overlayText: z.string().max(120).optional().default(""),
      })
    )
    .min(2)
    .max(6),
});

type RawScript = z.infer<typeof scriptSchema>;

const FRAMEWORK_GUIDE: Record<VideoFramework, string> = {
  problem_aha_proof_cta:
    "Scene 1 = Problem (the pain the audience feels RIGHT NOW). " +
    "Scene 2 = Aha (the product reveal, tension release). " +
    "Scene 3 = Proof (a concrete result, number, or testimonial). " +
    "Scene 4 = CTA (clear next step).",
  pas:
    "Scene 1 = Problem. Scene 2 = Agitation (intensify the pain). " +
    "Scene 3 = Solution (the product). Scene 4 = Push (CTA).",
  aida:
    "Scene 1 = Attention (scroll-stopping visual). " +
    "Scene 2 = Interest (why should I care). " +
    "Scene 3 = Desire (emotional benefit). Scene 4 = Action (CTA).",
  bab:
    "Scene 1 = Before (current painful state). " +
    "Scene 2 = After (transformed state). " +
    "Scene 3 = Bridge (how the product gets you there). Scene 4 = CTA.",
};

export async function generateVideoScript(params: {
  brandContext: BrandContext;
  framework: VideoFramework;
  language: VideoLanguage;
  durationSeconds: number;
  goal?: string;
  tone?: string;
  localeContext?: string;
  features?: string;
}): Promise<VideoScript> {
  const {
    brandContext,
    framework,
    language,
    durationSeconds,
    goal,
    tone,
    localeContext,
    features,
  } = params;

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

  const sceneCount = Math.max(
    2,
    Math.min(6, Math.round(durationSeconds / SCENE_DURATION_SECONDS))
  );
  const lang = language === "he" ? "Hebrew" : "English";

  const prompt = `You are a short-form video ad scriptwriter. Write a ${durationSeconds}-second vertical (9:16) social video script for this brand.

BRAND VOICE:
${brandContext.brandPersonality || "professional, engaging, modern"}

TARGET AUDIENCE:
${brandContext.audienceContext || "general audience"}

PRODUCT / SERVICE:
${brandContext.productContext || "the brand's product"}

BRAND POSITIONING:
${brandContext.brandPositioning || ""}

${brandContext.visual.styleKeywords ? `VISUAL STYLE: ${brandContext.visual.styleKeywords}\n` : ""}
${brandContext.intakePatterns ? `PROVEN CONTENT PATTERNS:\n${brandContext.intakePatterns}\n` : ""}
${localeContext ? `\n${localeContext}\n` : ""}

${features ? `PRODUCT CAPABILITIES (ONLY reference these confirmed features — do NOT invent features):\n${features.slice(0, 1000)}\n` : ""}
GOAL: ${goal || "drive awareness and sign-ups"}
TONE OVERRIDE: ${tone || "match the brand voice above"}
FRAMEWORK: ${framework}
FRAMEWORK GUIDE: ${FRAMEWORK_GUIDE[framework]}

LANGUAGE: All hook/keyMessage/cta/overlayText MUST be written in ${lang}. Scene prompts stay in English (they go to an image/video model).

STRUCTURE (${sceneCount} scenes × ${SCENE_DURATION_SECONDS}s = ${sceneCount * SCENE_DURATION_SECONDS}s):
- First scene's overlayText = the HOOK (stops the scroll in the first 3 seconds).
- Middle scenes advance the framework.
- Final scene's overlayText = the CTA.

Return ONLY a valid JSON object, no markdown code fences, no explanation.

JSON SHAPE:
{
  "hook": "<3-8 words in ${lang}, same as first scene overlayText>",
  "keyMessage": "<one-sentence proof point or metric in ${lang}>",
  "cta": "<2-5 words in ${lang}, same as last scene overlayText>",
  "scenes": [
    {
      "prompt": "<English visual description of the scene: subject, composition, mood, lighting, camera movement. NO text in the image. Vertical 9:16 framing. 8 seconds of action.>",
      "overlayText": "<3-10 words in ${lang} shown on screen during this scene>"
    }
  ]
}

Rules:
- Exactly ${sceneCount} scenes.
- Scene prompts must describe real, filmable shots (no abstract concepts).
- Scene prompts in English, all overlayText / hook / keyMessage / cta in ${lang}.
- Overlay text must be short enough to read in 2-3 seconds (max 10 words).
- Lean authentic UGC-style visuals, not cinematic stock-ad clichés.

${!brandContext.platformTypes?.some((p) => p === "ios" || p === "android") ? (brandContext.platformTypes?.some((p) => p === "pwa") ? "PLATFORM GUARD: This product is a PWA (mobile web app). It IS okay to show someone using it on a phone/tablet. Do NOT show app stores, app download screens, or 'available on App Store/Google Play' messaging.\n\n" : "PLATFORM GUARD: This product is a WEBSITE, not a mobile app. Do NOT show app stores, app download screens, or people using mobile apps. Show the product as a website on a laptop/desktop screen if needed.\n\n") : ""}CONTENT SAFETY (applies to ALL scenes):
- Do NOT include any religious symbols (crosses, Stars of David, crescents, menorahs, churches, mosques, synagogues)
- Do NOT include national flags, national emblems, or political imagery
- Do NOT include military imagery or culturally controversial symbols
- Keep visuals culturally neutral — focus on the product, people, and lifestyle

PEOPLE RULES (important — Veo rejects specific wording):
- People ARE allowed, but must be framed as clearly fictional synthetic characters.
- Every scene involving a person MUST begin with: "A fictional AI-generated person (not a real individual): ..."
- Use "a person" / "a character" — NEVER "the owner", "the founder", "the CEO", "the customer", "the manager" (these imply a specific real person and get blocked).
- Do NOT combine nationality + personal pronouns (no "an Israeli smile", "a French chef"). Describe actions instead.
- NO children (under 18). NO named real people. NO celebrities.
- Prefer medium/wide shots over extreme face close-ups. Show body language + environment, not just faces.
- Avoid text baked into the scene (logos fine, but no legible words) — overlay cards handle all text.`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();

  let raw: RawScript;
  try {
    raw = scriptSchema.parse(JSON.parse(cleaned));
  } catch {
    // Single retry with relaxed prompt
    const retry = await model.generateContent(
      `Return ONLY this JSON shape (no explanation): {"hook":"${lang} text","keyMessage":"${lang} sentence","cta":"${lang} cta","scenes":[{"prompt":"English visual desc","overlayText":"${lang} text"}]}. Exactly ${sceneCount} scenes.`
    );
    const retryText = retry.response
      .text()
      .trim()
      .replace(/^```(?:json)?\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();
    raw = scriptSchema.parse(JSON.parse(retryText));
  }

  const musicMood: MusicMood = inferMoodFromBrand(
    `${brandContext.brandPersonality} ${tone || ""}`
  );

  return {
    hook: raw.hook,
    keyMessage: raw.keyMessage,
    cta: raw.cta,
    framework,
    language,
    musicMood,
    totalDuration: raw.scenes.length * SCENE_DURATION_SECONDS,
    scenes: raw.scenes.map((s, i) => ({
      index: i,
      prompt: s.prompt,
      overlayText: s.overlayText || "",
      duration: SCENE_DURATION_SECONDS,
    })),
  };
}
