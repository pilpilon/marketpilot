import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseProjectSettings, buildLocaleContext } from "@/lib/ai/locale-context";
import { researchTrendingTopics } from "@/lib/ai/trending-research";

type SkillType = "email" | "video_script" | "content_calendar";

const SKILL_CONFIG: Record<
  SkillType,
  { campaignType: string; assetType: string; label: string }
> = {
  email: {
    campaignType: "email",
    assetType: "strategy_doc",
    label: "Email Campaign",
  },
  video_script: {
    campaignType: "video_ad",
    assetType: "video_script",
    label: "Video Script",
  },
  content_calendar: {
    campaignType: "content_marketing",
    assetType: "content_calendar",
    label: "Content Calendar",
  },
};

function buildContextBlock(
  files: Array<{ file_type: string; content: string }>
): string {
  const order = ["brand", "product", "audience", "competitors", "character_brief", "visual_style", "intake"];
  const sorted = [...files].sort(
    (a, b) => order.indexOf(a.file_type) - order.indexOf(b.file_type)
  );
  return sorted
    .map((f) => `## ${f.file_type.replace("_", " ").toUpperCase()}\n${f.content}`)
    .join("\n\n---\n\n");
}

async function geminiGenerate(prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

/**
 * Extract the brand niche/industry from context files for trending research.
 */
function extractNiche(files: Array<{ file_type: string; content: string }>): string {
  const brand = files.find((f) => f.file_type === "brand");
  if (brand) {
    // Try to extract the first meaningful line from brand positioning
    const lines = brand.content.split("\n").filter((l) => l.trim().length > 10);
    if (lines.length > 0) return lines[0].slice(0, 200);
  }
  const product = files.find((f) => f.file_type === "product");
  if (product) {
    const lines = product.content.split("\n").filter((l) => l.trim().length > 10);
    if (lines.length > 0) return lines[0].slice(0, 200);
  }
  return "general marketing";
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, skillType, options } = await request.json() as {
    projectId: string;
    skillType: SkillType;
    options?: {
      platforms?: string[];
      count?: number;
      goal?: string;
      tone?: string;
      campaignName?: string;
    };
  };

  if (!projectId || !skillType || !SKILL_CONFIG[skillType]) {
    return NextResponse.json({ error: "Invalid skill or project" }, { status: 400 });
  }

  // Verify project ownership and get settings
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Parse locale settings
  const settings = parseProjectSettings(project.settings);
  const localeCtx = buildLocaleContext(settings);

  // Load full intelligence context
  const { data: contextFiles } = await supabase
    .from("context_files")
    .select("file_type, content")
    .eq("project_id", projectId);

  if (!contextFiles || contextFiles.length === 0) {
    return NextResponse.json(
      { error: "No brand intelligence found. Run the analyzer first." },
      { status: 400 }
    );
  }

  const context = buildContextBlock(
    contextFiles as Array<{ file_type: string; content: string }>
  );

  const config = SKILL_CONFIG[skillType];
  const skillOptions = options || {};

  // Default platforms based on locale
  const defaultPlatforms = settings.market === "IL"
    ? "Instagram, Facebook, TikTok"
    : "Twitter, Instagram, LinkedIn";

  // Build skill-specific prompt
  const assetsToCreate: Array<{ title: string; content: string }> = [];
  let trendingContext = "";

  if (skillType === "email") {
    const goal = skillOptions.goal || "nurture leads and drive conversions";

    const emailContent = await geminiGenerate(
      `You are an expert email marketer. Write a complete email campaign for the following brand.

BRAND INTELLIGENCE:
${context}
${localeCtx.skillContext ? `\n${localeCtx.skillContext}\n` : ""}
TASK:
- Goal: ${goal}
- Tone: ${skillOptions.tone || "match the brand voice"}

Write a 3-email nurture sequence:

EMAIL 1 — Welcome / Introduction
Subject: [subject line]
Preview text: [preview text]
Body: [full email body with clear sections]

EMAIL 2 — Value / Education
Subject: [subject line]
Preview text: [preview text]
Body: [full email body]

EMAIL 3 — Conversion / CTA
Subject: [subject line]
Preview text: [preview text]
Body: [full email body]

Make each email feel personal, on-brand, and drive the reader toward the goal.`
    );

    assetsToCreate.push({
      title: `Email sequence: ${goal}`,
      content: emailContent,
    });
  } else if (skillType === "video_script") {
    const goal = skillOptions.goal || "product awareness ad";

    const script = await geminiGenerate(
      `You are an expert video ad scriptwriter. Write a video script for the following brand.

BRAND INTELLIGENCE:
${context}
${localeCtx.skillContext ? `\n${localeCtx.skillContext}\n` : ""}
TASK:
- Format: ${goal}
- Length: 30-60 second script
- Tone: ${skillOptions.tone || "match the brand character brief"}

Write a complete video script with:
HOOK (first 3 seconds):
[hook line]

SCENE-BY-SCENE BREAKDOWN:
[Scene 1]
Visual: [describe what's on screen]
Audio/VO: [narration or dialogue]
Duration: [seconds]

[Scene 2]
...

CTA (final 5 seconds):
Visual: [what's shown]
VO/Text: [call to action]

Also provide:
SUGGESTED VISUALS: [3-5 shot ideas]
MUSIC MOOD: [describe audio atmosphere]`
    );

    assetsToCreate.push({
      title: `Video script: ${goal}`,
      content: script,
    });
  } else if (skillType === "content_calendar") {
    const platforms = skillOptions.platforms?.join(", ") || defaultPlatforms;

    // Research trending topics for content calendar too
    const niche = extractNiche(contextFiles as Array<{ file_type: string; content: string }>);
    trendingContext = await researchTrendingTopics(niche, settings.market);

    const trendingSection = trendingContext
      ? `\nCURRENT TRENDING TOPICS:\n${trendingContext}\n\nWeave timely topics into the first 1-2 weeks of the calendar where they fit naturally.\n`
      : "";

    const calendar = await geminiGenerate(
      `You are a content strategy expert. Create a 4-week content calendar for the following brand.

BRAND INTELLIGENCE:
${context}
${trendingSection}${localeCtx.skillContext ? `\n${localeCtx.skillContext}\n` : ""}
TASK:
- Platforms: ${platforms}
- Goal: ${skillOptions.goal || "build audience and drive awareness"}
- Tone: ${skillOptions.tone || "match brand character brief"}

Create a structured 4-week content calendar:

WEEK 1 THEME: [theme]
Mon: [platform] — [post type] — [brief description]
Wed: [platform] — [post type] — [brief description]
Fri: [platform] — [post type] — [brief description]

WEEK 2 THEME: [theme]
...

WEEK 3 THEME: [theme]
...

WEEK 4 THEME: [theme]
...

CONTENT PILLARS USED: [list the recurring themes]
RECOMMENDED POSTING TIMES: [platform-specific suggestions]`
    );

    assetsToCreate.push({
      title: `4-week content calendar`,
      content: calendar,
    });
  }

  // Create campaign
  const campaignName =
    skillOptions.campaignName ||
    `${config.label} — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      project_id: projectId,
      user_id: user.id,
      name: campaignName,
      campaign_type: config.campaignType,
      platforms: skillOptions.platforms || [],
      status: "draft",
      goal: skillOptions.goal || null,
      metadata: trendingContext
        ? { trending_context: trendingContext, researched_at: new Date().toISOString() }
        : {},
    })
    .select()
    .single();

  if (campaignError) {
    return NextResponse.json({ error: campaignError.message }, { status: 500 });
  }

  // Create assets
  const assetInserts = assetsToCreate.map((a) => ({
    campaign_id: (campaign as { id: string }).id,
    user_id: user.id,
    asset_type: config.assetType,
    title: a.title,
    content: a.content,
    status: "draft",
  }));

  const { data: assets, error: assetsError } = await supabase
    .from("campaign_assets")
    .insert(assetInserts)
    .select();

  if (assetsError) {
    return NextResponse.json({ error: assetsError.message }, { status: 500 });
  }

  // Log analysis run
  await supabase.from("analysis_runs").insert({
    project_id: projectId,
    user_id: user.id,
    run_type: `skill_${skillType}`,
    provider: "gemini",
    status: "completed",
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json({
    campaign,
    assets,
    assetsGenerated: (assets || []).length,
  });
}
