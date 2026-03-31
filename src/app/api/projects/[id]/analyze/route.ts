import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { perplexityResearch } from "@/lib/ai/perplexity";
import { parseProjectSettings, buildLocaleContext } from "@/lib/ai/locale-context";
import { generateSOP } from "@/lib/ai/sop-template";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: run } = await supabase
    .from("analysis_runs")
    .select("id, status, error_message, completed_at, created_at")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ run: run ?? null });
}

// Gemini for synthesis and structured output
async function geminiGenerate(prompt: string): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project)
    return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const projectName = project.name as string;
  const projectUrl = project.url as string | null;
  const projectDesc = project.description as string | null;

  // Parse locale settings
  const settings = parseProjectSettings(project.settings);
  const localeCtx = buildLocaleContext(settings);

  // Create analysis run record
  const { data: run } = await supabase
    .from("analysis_runs")
    .insert({
      project_id: projectId,
      user_id: user.id,
      run_type: "full_brand_analysis",
      provider: "perplexity",
      status: "running",
    })
    .select()
    .single();

  const runId = (run as { id: string } | null)?.id;

  try {
    const context = [
      projectUrl ? `Website: ${projectUrl}` : null,
      projectDesc ? `Description: ${projectDesc}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    // 1. Competitor research via Perplexity
    const competitorResearch = await perplexityResearch(
      `Research the top 3-5 direct competitors of "${projectName}". ${context}
      For each competitor provide:
      - Company name and website
      - Core product/service and positioning
      - Target audience
      - Key differentiators and weaknesses
      - Estimated market share or traction signals
      - Their social media presence and content strategy${localeCtx.researchContext}`
    );

    // 2. Audience research via Perplexity
    const audienceResearch = await perplexityResearch(
      `Research the target audience and market for "${projectName}". ${context}
      Provide:
      - Primary buyer personas (demographics, psychographics, job titles if B2B)
      - Key pain points and motivations
      - Where they spend time online (platforms, communities, publications)
      - How they evaluate and buy products like this
      - Common objections and concerns${localeCtx.researchContext}`
    );

    // 3. Brand positioning via Gemini (synthesis)
    const brandDoc = await geminiGenerate(
      `You are a senior brand strategist. Based on the following research, create a comprehensive brand positioning document for "${projectName}".

${context}

Competitor landscape:
${competitorResearch}

Target audience:
${audienceResearch}
${localeCtx.synthesisContext}

Write a Brand Positioning document with these sections:
## Brand Promise
(One sentence that captures the core value delivered)

## Positioning Statement
(Classic format: For [target], [brand] is the [category] that [benefit] because [reason to believe])

## Brand Pillars
(3-4 core values/themes that define the brand)

## Key Differentiators
(What sets this product apart from competitors - be specific)

## Brand Voice & Tone
(Personality traits, communication style, what to avoid)

Be specific and actionable. Base everything on real market positioning gaps you identified.`
    );

    // 4. Product brief via Gemini
    const productDoc = await geminiGenerate(
      `You are a product marketer. Create a Product Brief for "${projectName}".

${context}

Market context:
${competitorResearch.slice(0, 1000)}
${localeCtx.synthesisContext}

Write a Product Brief with these sections:
## Core Value Proposition
(The primary problem solved and outcome delivered)

## Feature Highlights
(3-5 key capabilities with their customer benefits - not just features)

## Use Cases
(3 concrete scenarios where customers use this)

## Proof Points
(Claims, metrics, or credibility signals that support the value prop)

## Pricing Context
(Where it fits in the market - premium, value, mid-market)

Keep it tight and focused on what matters for marketing.`
    );

    // 5. Character brief via Gemini
    const characterDoc = await geminiGenerate(
      `You are a brand identity strategist. Create a Character Brief for "${projectName}" — a guide for anyone creating content for this brand.

Brand positioning context:
${brandDoc.slice(0, 800)}
${localeCtx.synthesisContext}

Write a Character Brief with these sections:
## Brand Personality
(5-6 personality adjectives with brief explanations)

## Content Tone Examples
(3 pairs of "We say / We don't say" examples)

## Content Themes
(4-5 recurring topics/angles this brand owns)

## Hashtag Strategy
(10-15 hashtags: mix of branded, category, and community tags)

## Content Calendar Themes
(Suggested weekly/monthly content rhythms)

This will guide the skills engine when generating posts and campaigns.`
    );

    // 6. Visual style via Gemini
    const visualDoc = await geminiGenerate(
      `You are a visual brand consultant. Create a Visual Style Guide brief for "${projectName}" based on their positioning.

Brand context:
${brandDoc.slice(0, 600)}
${localeCtx.synthesisContext}

Write a Visual Style Guide with:
## Color Palette Direction
(Primary emotional associations and suggested directions, not hex codes)

## Typography Personality
(Serif vs sans-serif, modern vs classic, formal vs playful guidance)

## Imagery Style
(Photography style, illustration vs photo, mood, subjects)

## Layout & Composition
(Clean vs busy, whitespace usage, grid preferences)

## Visual Dos and Don'ts
(What visual choices reinforce the brand vs undermine it)

This guides image selection and creative direction for social posts.`
    );

    // 7. Generate SOP document
    const sopDoc = generateSOP(
      projectName,
      settings,
      new Date().toISOString().split("T")[0]
    );

    // Upsert all context files
    const contextUpserts = [
      { file_type: "brand", content: brandDoc },
      { file_type: "product", content: productDoc },
      { file_type: "audience", content: audienceResearch },
      { file_type: "competitors", content: competitorResearch },
      { file_type: "character_brief", content: characterDoc },
      { file_type: "visual_style", content: visualDoc },
      { file_type: "sop", content: sopDoc },
    ];

    for (const cf of contextUpserts) {
      // Check if exists
      const { data: existing } = await supabase
        .from("context_files")
        .select("id")
        .eq("project_id", projectId)
        .eq("file_type", cf.file_type)
        .single();

      if (existing) {
        await supabase
          .from("context_files")
          .update({ content: cf.content, source: "auto", version: 1 })
          .eq("id", (existing as { id: string }).id);
      } else {
        await supabase.from("context_files").insert({
          project_id: projectId,
          user_id: user.id,
          file_type: cf.file_type,
          content: cf.content,
          source: "auto",
        });
      }
    }

    // Mark project active
    await supabase
      .from("projects")
      .update({ status: "active" })
      .eq("id", projectId);

    // Complete the analysis run
    if (runId) {
      await supabase
        .from("analysis_runs")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", runId);
    }

    return NextResponse.json({ success: true, filesGenerated: contextUpserts.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";

    if (runId) {
      await supabase
        .from("analysis_runs")
        .update({ status: "failed", error_message: message })
        .eq("id", runId);
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
