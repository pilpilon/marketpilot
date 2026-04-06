import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { perplexityResearch, perplexitySynthesize } from "@/lib/ai/perplexity";
import { parseProjectSettings, buildLocaleContext } from "@/lib/ai/locale-context";
import { generateSOP } from "@/lib/ai/sop-template";
import { captureScreenshot, VIEWPORTS } from "@/lib/screenshots/capture";
import { createClient } from "@supabase/supabase-js";
import { ensureDeviceFrames } from "@/lib/screenshots/mockup";

// Each step should complete within 60s
export const maxDuration = 60;

// Scrape website content — extracts meta tags + body text
async function scrapeWebsite(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MarketPilot-Bot/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return "";
    const html = await res.text();

    // Extract meta tags (critical for SPAs that render client-side)
    const metaParts: string[] = [];
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) metaParts.push(`Title: ${titleMatch[1].trim()}`);

    const metaRegex = /<meta\s+(?:[^>]*?)(?:name|property)="([^"]*)"[^>]*content="([^"]*)"[^>]*>/gi;
    let match;
    while ((match = metaRegex.exec(html)) !== null) {
      const name = match[1].toLowerCase();
      if (["description", "keywords", "og:description", "og:title", "twitter:description", "twitter:title"].includes(name)) {
        metaParts.push(`${match[1]}: ${match[2]}`);
      }
    }

    // Also try content attr before name attr (different order in HTML)
    const metaRegex2 = /<meta\s+content="([^"]*)"[^>]*(?:name|property)="([^"]*)"[^>]*>/gi;
    while ((match = metaRegex2.exec(html)) !== null) {
      const name = match[2].toLowerCase();
      if (["description", "keywords", "og:description", "og:title", "twitter:description", "twitter:title"].includes(name)) {
        metaParts.push(`${match[2]}: ${match[1]}`);
      }
    }

    // Extract visible body text (for non-SPA sites)
    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // If body has real content (>200 chars after stripping), use it
    const bodyContent = bodyText.length > 200 ? `\nPage content: ${bodyText.slice(0, 3000)}` : "";

    const result = metaParts.join("\n") + bodyContent;
    return result || bodyText.slice(0, 3000);
  } catch {
    return "";
  }
}

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
    .select("id, status, error_message, completed_at, created_at, metadata")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ run: run ?? null });
}

// Helper: read a context file from DB
async function readContextFile(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, projectId: string, fileType: string): Promise<string> {
  const { data } = await supabase
    .from("context_files")
    .select("content")
    .eq("project_id", projectId)
    .eq("file_type", fileType)
    .single();
  return (data as { content: string } | null)?.content ?? "";
}

// Helper: save a context file to DB
async function saveContextFile(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  projectId: string,
  userId: string,
  fileType: string,
  content: string
) {
  const { data: existing } = await supabase
    .from("context_files")
    .select("id")
    .eq("project_id", projectId)
    .eq("file_type", fileType)
    .single();

  if (existing) {
    await supabase
      .from("context_files")
      .update({ content, source: "auto", version: 1 })
      .eq("id", (existing as { id: string }).id);
  } else {
    await supabase.from("context_files").insert({
      project_id: projectId,
      user_id: userId,
      file_type: fileType,
      content,
      source: "auto",
    });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const step = body.step as string;

  if (!step) {
    return NextResponse.json({ error: "Missing step parameter" }, { status: 400 });
  }

  // Verify ownership + load project
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
  const brandUrls = (project.brand_urls ?? []) as Array<{ url: string; type: string }>;
  const settings = parseProjectSettings(project.settings);
  const localeCtx = buildLocaleContext(settings);

  const TYPE_LABELS: Record<string, string> = {
    facebook: "Facebook Page",
    instagram: "Instagram Profile",
    linkedin: "LinkedIn Page",
    tiktok: "TikTok Profile",
    youtube: "YouTube Channel",
    other: "Online Presence",
  };

  const contextLines = [
    projectUrl ? `Website: ${projectUrl}` : null,
    ...brandUrls.map((b) => `${TYPE_LABELS[b.type] ?? "Online Presence"}: ${b.url}`),
    projectDesc ? `Description: ${projectDesc}` : null,
  ];
  const context = contextLines.filter(Boolean).join("\n");

  // Load scraped website content from the running analysis run
  let websiteContent = "";
  if (step !== "start") {
    const { data: runMeta } = await supabase
      .from("analysis_runs")
      .select("metadata")
      .eq("project_id", projectId)
      .eq("status", "running")
      .limit(1)
      .single();
    websiteContent = (runMeta as { metadata?: { websiteContent?: string } } | null)?.metadata?.websiteContent ?? "";
  }

  const websiteInstruction = websiteContent
    ? `CRITICAL: Here is the ACTUAL content from ${projectUrl}. Use ONLY this to understand what the product does. Do NOT guess from the name "${projectName}":\n\n--- WEBSITE CONTENT ---\n${websiteContent}\n--- END WEBSITE CONTENT ---`
    : projectUrl
      ? `Visit ${projectUrl} to understand what "${projectName}" does.`
      : "";

  try {
    switch (step) {
      // ─── Step 1: Start ────────────────────────────────────────
      case "start": {
        // Clear old context files (keep user uploads)
        await supabase
          .from("context_files")
          .delete()
          .eq("project_id", projectId)
          .neq("file_type", "intake");

        // Mark any stuck runs as failed
        await supabase
          .from("analysis_runs")
          .update({ status: "failed", error_message: "Superseded by new run" })
          .eq("project_id", projectId)
          .eq("status", "running");

        // Scrape the actual website content so AI has real data
        let websiteContent = "";
        if (projectUrl) {
          console.log(`[analyze] Scraping website: ${projectUrl}`);
          websiteContent = await scrapeWebsite(projectUrl);
          console.log(`[analyze] Scraped ${websiteContent.length} chars from website`);
        }

        // Best-effort: capture screenshots of the website for asset generation
        if (projectUrl) {
          try {
            await ensureDeviceFrames();
            const serviceSupabase = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            for (const viewport of ["desktop", "mobile"] as const) {
              try {
                const capture = await captureScreenshot(projectUrl, viewport);
                const spec = VIEWPORTS[viewport];
                const fileName = `screenshots/${user.id}/${projectId}/${viewport}-${Date.now()}.png`;

                await serviceSupabase.storage
                  .from("generated-images")
                  .upload(fileName, capture.buffer, { contentType: "image/png", upsert: true });

                const { data: urlData } = serviceSupabase.storage
                  .from("generated-images")
                  .getPublicUrl(fileName);

                // Clear old screenshots for this viewport
                await supabase
                  .from("project_screenshots")
                  .delete()
                  .eq("project_id", projectId)
                  .eq("user_id", user.id)
                  .eq("viewport", viewport);

                await supabase.from("project_screenshots").insert({
                  project_id: projectId,
                  user_id: user.id,
                  viewport,
                  storage_path: fileName,
                  public_url: urlData.publicUrl,
                  width: spec.width * (spec.deviceScaleFactor ?? 2),
                  height: spec.height * (spec.deviceScaleFactor ?? 2),
                  approved: false,
                });
              } catch (e) {
                console.error(`[analyze] Screenshot ${viewport} capture failed:`, e instanceof Error ? e.message : e);
              }
            }
          } catch (e) {
            console.error("[analyze] Screenshot setup failed:", e instanceof Error ? e.message : e);
          }
        }

        // Create new run with scraped content in metadata
        const { data: run } = await supabase
          .from("analysis_runs")
          .insert({
            project_id: projectId,
            user_id: user.id,
            run_type: "full_brand_analysis",
            provider: "perplexity",
            status: "running",
            metadata: { step: "start", current: 0, total: 8, websiteContent },
          })
          .select("id")
          .single();

        return NextResponse.json({ runId: (run as { id: string })?.id });
      }

      // ─── Step 2: Competitors ──────────────────────────────────
      case "competitors": {
        const result = await perplexityResearch(
          `${websiteInstruction}\n\n${context}\n\nResearch the top 3-5 direct competitors of "${projectName}" based on what the company ACTUALLY does (as described on their website).
For each competitor provide:
- Company name and website
- Core product/service and positioning
- Target audience
- Key differentiators and weaknesses
- Estimated market share or traction signals
- Their social media presence and content strategy${localeCtx.researchContext}`
        );
        await saveContextFile(supabase, projectId, user.id, "competitors", result);
        return NextResponse.json({ done: true });
      }

      // ─── Step 3: Audience ─────────────────────────────────────
      case "audience": {
        const result = await perplexityResearch(
          `${websiteInstruction}\n\n${context}\n\nResearch the target audience and market for "${projectName}" based on what the company ACTUALLY does (as described on their website).
Provide:
- Primary buyer personas (demographics, psychographics, job titles if B2B)
- Key pain points and motivations
- Where they spend time online (platforms, communities, publications)
- How they evaluate and buy products like this
- Common objections and concerns${localeCtx.researchContext}`
        );
        await saveContextFile(supabase, projectId, user.id, "audience", result);
        return NextResponse.json({ done: true });
      }

      // ─── Step 4: Social ───────────────────────────────────────
      case "social": {
        if (brandUrls.length === 0) {
          return NextResponse.json({ done: true, skipped: true });
        }
        const socialUrlList = brandUrls.map((b) => `${TYPE_LABELS[b.type] ?? b.type}: ${b.url}`).join("\n");
        const result = await perplexityResearch(
          `Analyze the social media presence of "${projectName}" based on their profiles:\n${socialUrlList}\n\nProvide:
- Content themes and topics they post about most
- Posting frequency and consistency patterns
- Engagement levels and audience interaction style
- Visual style and branding consistency across platforms
- Top-performing content types (video, images, text, stories)
- Hashtag usage and community building approach
- Strengths and gaps in their current social strategy${localeCtx.researchContext}`
        );
        // Store as metadata on the run (used by brand synthesis step)
        await supabase
          .from("analysis_runs")
          .update({ metadata: { socialResearch: result } })
          .eq("project_id", projectId)
          .eq("status", "running");
        return NextResponse.json({ done: true });
      }

      // ─── Step 5: Brand ────────────────────────────────────────
      case "brand": {
        const competitors = await readContextFile(supabase, projectId, "competitors");
        const audience = await readContextFile(supabase, projectId, "audience");

        // Read social research from run metadata if available
        const { data: currentRun } = await supabase
          .from("analysis_runs")
          .select("metadata")
          .eq("project_id", projectId)
          .eq("status", "running")
          .limit(1)
          .single();
        const socialResearch = (currentRun as { metadata?: { socialResearch?: string } } | null)?.metadata?.socialResearch ?? "";

        const result = await perplexitySynthesize(
          `You are a senior brand strategist. Create a comprehensive brand positioning document for "${projectName}".
IMPORTANT: The product description and website content below define what this company ACTUALLY does. Do NOT guess from the company name.

${context}

Competitor landscape:
${competitors}

Target audience:
${audience}
${socialResearch ? `\nSocial media presence analysis:\n${socialResearch}` : ""}
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
        await saveContextFile(supabase, projectId, user.id, "brand", result);
        return NextResponse.json({ done: true });
      }

      // ─── Step 6: Product ──────────────────────────────────────
      case "product": {
        const competitors = await readContextFile(supabase, projectId, "competitors");

        const result = await perplexitySynthesize(
          `You are a product marketer. Create a Product Brief for "${projectName}".

${context}

Market context:
${competitors.slice(0, 1500)}
${localeCtx.synthesisContext}

Write a Product Brief with these sections:
## Core Value Proposition
## Feature Highlights (3-5 key capabilities with customer benefits)
## Use Cases (3 concrete scenarios)
## Proof Points (claims, metrics, credibility signals)
## Pricing Context (market positioning)

Keep it tight and focused on what matters for marketing.`
        );
        await saveContextFile(supabase, projectId, user.id, "product", result);
        return NextResponse.json({ done: true });
      }

      // ─── Step 6b: Features ─────────────────────────────────────
      case "features": {
        const product = await readContextFile(supabase, projectId, "product");

        const result = await perplexitySynthesize(
          `You are a product analyst. Extract a STRUCTURED list of CONFIRMED features and capabilities from "${projectName}".

${websiteInstruction}

${context}

Product brief:
${product.slice(0, 1500)}
${localeCtx.synthesisContext}

RULES:
- Only list features you can VERIFY from the website content or product brief
- Do NOT invent or assume features that aren't mentioned
- If a feature is unclear, mark it as "Unverified"
- Determine the platform type (website only, mobile app, desktop app, physical product)
- List what the product explicitly does NOT have (if you can determine this)

Output format (use this EXACT structure):

## Confirmed Features
- [feature name]: [one-line description]

## Platform Type
- [x] Website
- [ ] Mobile App (iOS)
- [ ] Mobile App (Android)
- [ ] Desktop App
- [ ] Physical Product

Check the boxes that apply based on the website content. If the product is ONLY a website with no mobile app, leave mobile unchecked.

## Unverified / Needs User Input
- [anything unclear or that needs user confirmation]

## What This Product Does NOT Have
- [any capabilities the product clearly lacks based on the website]`
        );
        await saveContextFile(supabase, projectId, user.id, "features", result);
        return NextResponse.json({ done: true });
      }

      // ─── Step 7: Character ────────────────────────────────────
      case "character": {
        const brand = await readContextFile(supabase, projectId, "brand");

        const result = await perplexitySynthesize(
          `You are a brand identity strategist. Create a Character Brief for "${projectName}" — a guide for anyone creating content for this brand.

Brand positioning context:
${brand.slice(0, 1200)}
${localeCtx.synthesisContext}

Write a Character Brief with these sections:
## Brand Personality (5-6 personality adjectives with explanations)
## Content Tone Examples (3 pairs of "We say / We don't say")
## Content Themes (4-5 recurring topics/angles)
## Hashtag Strategy (10-15 hashtags: branded, category, community)
## Content Calendar Themes (weekly/monthly rhythms)

This will guide the skills engine when generating posts and campaigns.`
        );
        await saveContextFile(supabase, projectId, user.id, "character_brief", result);
        return NextResponse.json({ done: true });
      }

      // ─── Step 8: Visual Style ─────────────────────────────────
      case "visual_style": {
        const brand = await readContextFile(supabase, projectId, "brand");

        const result = await perplexitySynthesize(
          `You are a visual brand consultant. Create a Visual Style Guide brief for "${projectName}".

Brand context:
${brand.slice(0, 800)}
${localeCtx.synthesisContext}

Write a Visual Style Guide with:
## Color Palette Direction (emotional associations, suggested directions)
## Typography Personality (serif vs sans-serif, modern vs classic)
## Imagery Style (photography, illustration, mood, subjects)
## Layout & Composition (clean vs busy, whitespace, grid)
## Visual Dos and Don'ts

This guides image selection and creative direction for social posts.`
        );
        await saveContextFile(supabase, projectId, user.id, "visual_style", result);
        return NextResponse.json({ done: true });
      }

      // ─── Step 9: SOP ──────────────────────────────────────────
      case "sop": {
        const sopDoc = generateSOP(projectName, settings, new Date().toISOString().split("T")[0]);
        await saveContextFile(supabase, projectId, user.id, "sop", sopDoc);
        return NextResponse.json({ done: true });
      }

      // ─── Step 10: Complete ────────────────────────────────────
      case "complete": {
        await supabase
          .from("projects")
          .update({ status: "active" })
          .eq("id", projectId);

        await supabase
          .from("analysis_runs")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("project_id", projectId)
          .eq("status", "running");

        return NextResponse.json({ done: true });
      }

      default:
        return NextResponse.json({ error: `Unknown step: ${step}` }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis step failed";
    console.error(`[analyze] Step "${step}" failed:`, message);

    // Mark run as failed
    await supabase
      .from("analysis_runs")
      .update({ status: "failed", error_message: `Step "${step}": ${message}` })
      .eq("project_id", projectId)
      .eq("status", "running");

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
