import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildProjectContext } from "@/lib/ai/build-context";
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

  // Pull character_brief specifically — it has brand hashtag strategy
  let hashtagContext = "";
  if (projectId) {
    const fullContext = await buildProjectContext(supabase, projectId, user.id);
    // Extract just the character brief section which contains hashtag strategy
    const charBriefMatch = fullContext.match(/### CHARACTER BRIEF[\s\S]*?(?=---|\n###|$)/i);
    if (charBriefMatch) {
      hashtagContext = charBriefMatch[0];
    } else {
      hashtagContext = fullContext;
    }
  }

  const platformNote = platform
    ? `Platform: ${platform}. Use platform-appropriate hashtags.`
    : "";

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const result = await model.generateContent([
    `You are a social media hashtag strategist. Generate 8-12 highly relevant hashtags.

${hashtagContext ? `Brand context:\n${hashtagContext}\n\n` : ""}Post topic: ${prompt}
${platformNote}

Rules:
- Mix branded hashtags (from character brief if available), category hashtags, and trending community hashtags
- No # symbol prefix
- One hashtag per line
- Prioritize specificity over generic tags (e.g., "b2bsales" > "business")
- Output ONLY the hashtags, nothing else`,
  ]);

  const text = result.response.text().trim();
  const hashtags = text
    .split("\n")
    .map((h) => h.trim().replace(/^#/, "").replace(/\s+/g, ""))
    .filter(Boolean);

  return NextResponse.json({ hashtags });
}
