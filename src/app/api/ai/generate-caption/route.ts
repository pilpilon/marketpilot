import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildProjectContext } from "@/lib/ai/build-context";
import { getCondensedStorytellingGuidance } from "@/lib/ai/storytelling-framework";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, prompt, platform } = await request.json();

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Google AI API key not configured" },
      { status: 500 }
    );
  }

  // Build full brand intelligence context
  const context = projectId
    ? await buildProjectContext(supabase, projectId, user.id)
    : "";

  const platformConstraints: Record<string, string> = {
    twitter: "Max 280 characters. Punchy and direct. No fluff.",
    instagram: "Up to 2200 characters. Can be more narrative. Emojis welcome.",
    tiktok: "Casual, trend-aware, Gen Z friendly. Short hook.",
    linkedin: "Professional tone. Thought leadership angle.",
  };
  const platformNote = platform
    ? `\nPlatform: ${platform}. Constraint: ${platformConstraints[platform.toLowerCase()] || ""}`
    : "";

  const storytellingGuidance = getCondensedStorytellingGuidance();

  const systemPrompt = `You are an expert social media copywriter. Generate an engaging, on-brand social media caption.

${context ? `${context}\n\n` : ""}Rules:
- Write in the brand's voice and tone from the character brief above
- ${storytellingGuidance}
- Be concise and engaging
- Include a clear call to action where appropriate
- Do NOT include hashtags (those are handled separately)${platformNote}
- Output ONLY the caption text, nothing else`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const result = await model.generateContent([systemPrompt, prompt]);
  const caption = result.response.text().trim();

  return NextResponse.json({ caption });
}
