import { NextResponse, after } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseProjectSettings, buildLocaleContext } from "@/lib/ai/locale-context";
import { researchTrendingTopics } from "@/lib/ai/trending-research";
import { loadBrandContext } from "@/lib/templates/brand-tokens";
import { buildScheduleSlots, type TimeRange, type PostSlot } from "@/lib/skills/schedule-builder";
import { generateCreativeImage, type BrandContext } from "@/lib/skills/creative-designer";
import { SYSTEM_TEMPLATES } from "@/lib/templates/system-templates";

export const maxDuration = 300;

const VALID_TIME_RANGES: TimeRange[] = ["1_week", "2_weeks", "3_weeks", "1_month"];

interface ContentPlanPost {
  slotIndex: number;
  category: string;
  templateId: string;
  postConcept: string;
  headline: string;
  subheadline: string;
}

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

function extractNiche(files: Array<{ file_type: string; content: string }>): string {
  const brand = files.find((f) => f.file_type === "brand");
  if (brand) {
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

/** Build the available template categories string for the AI prompt */
function getTemplateCategories(): string {
  const categories = new Map<string, string>();
  for (const t of SYSTEM_TEMPLATES) {
    if (!categories.has(t.category)) {
      categories.set(t.category, t.description);
    }
  }
  return Array.from(categories.entries())
    .map(([cat, desc]) => `- ${cat}: ${desc}`)
    .join("\n");
}

/** Find a suitable template ID for a category + platform */
function findTemplateId(category: string, platformKey: string): string {
  const match = SYSTEM_TEMPLATES.find(
    (t) => t.category === category && t.platforms.includes(platformKey)
  );
  if (match) return match.id;
  // Fallback: any template in that category
  const catMatch = SYSTEM_TEMPLATES.find((t) => t.category === category);
  if (catMatch) return catMatch.id;
  // Last resort
  return SYSTEM_TEMPLATES[0]?.id || "sys-promo-bottom-bar";
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { projectId, platforms, timeRange, campaignName } = body as {
    projectId: string;
    platforms: string[];
    timeRange: TimeRange;
    campaignName?: string;
  };

  // Validate
  if (!projectId || !platforms?.length || !VALID_TIME_RANGES.includes(timeRange)) {
    return NextResponse.json(
      { error: "projectId, platforms[], and valid timeRange are required" },
      { status: 400 }
    );
  }

  // Verify project ownership
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Create campaign
  const name =
    campaignName ||
    `Content Calendar — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      project_id: projectId,
      user_id: user.id,
      name,
      campaign_type: "content_marketing",
      platforms,
      status: "draft",
    })
    .select()
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: campaignError?.message || "Failed to create campaign" }, { status: 500 });
  }

  const campaignId = (campaign as { id: string }).id;

  // Create pipeline job
  const { data: job, error: jobError } = await supabase
    .from("pipeline_jobs")
    .insert({
      project_id: projectId,
      user_id: user.id,
      campaign_id: campaignId,
      job_type: "content_calendar",
      status: "pending",
      current_step: "Initializing...",
    })
    .select()
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: jobError?.message || "Failed to create pipeline job" }, { status: 500 });
  }

  const jobId = (job as { id: string }).id;

  // Run pipeline in background after response is sent
  after(async () => {
    // Use service role for background updates (no user session available in after())
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      await runPipeline({
        serviceSupabase,
        userId: user.id,
        projectId,
        campaignId,
        jobId,
        platforms,
        timeRange,
        projectSettings: project.settings,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Pipeline failed";
      await serviceSupabase
        .from("pipeline_jobs")
        .update({ status: "failed", error_message: msg, updated_at: new Date().toISOString() })
        .eq("id", jobId);
    }
  });

  return NextResponse.json({ jobId, campaignId });
}

async function updateJob(
  supabase: SupabaseClient<any, any, any>,
  jobId: string,
  updates: Record<string, unknown>
) {
  await supabase
    .from("pipeline_jobs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

async function runPipeline(params: {
  serviceSupabase: SupabaseClient<any, any, any>;
  userId: string;
  projectId: string;
  campaignId: string;
  jobId: string;
  platforms: string[];
  timeRange: TimeRange;
  projectSettings: unknown;
}) {
  const { serviceSupabase, userId, projectId, campaignId, jobId, platforms, timeRange, projectSettings } = params;

  // ── Step A: Planning ──────────────────────────────────────────────────────
  await updateJob(serviceSupabase, jobId, { status: "planning", current_step: "Loading brand intelligence..." });

  const settings = parseProjectSettings(projectSettings);
  const localeCtx = buildLocaleContext(settings);
  const locale = settings.locale || "en";

  // Load brand context
  const brandContext = await loadBrandContext(serviceSupabase, projectId);

  // Load context files for AI prompt
  const { data: contextFiles } = await serviceSupabase
    .from("context_files")
    .select("file_type, content")
    .eq("project_id", projectId);

  if (!contextFiles || contextFiles.length === 0) {
    throw new Error("No brand intelligence found. Run the analyzer first.");
  }

  const context = buildContextBlock(contextFiles as Array<{ file_type: string; content: string }>);

  // Research trending topics
  await updateJob(serviceSupabase, jobId, { current_step: "Researching trending topics..." });
  const niche = extractNiche(contextFiles as Array<{ file_type: string; content: string }>);
  const trendingContext = await researchTrendingTopics(niche, settings.market);

  // Build schedule slots
  await updateJob(serviceSupabase, jobId, { current_step: "Building posting schedule..." });
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1); // Start tomorrow

  const slots = buildScheduleSlots({
    platforms,
    timeRange,
    startDate,
    locale: locale as "en" | "he",
  });

  if (slots.length === 0) {
    throw new Error("No schedule slots could be generated");
  }

  // Generate content plan with AI
  await updateJob(serviceSupabase, jobId, { current_step: "Planning content themes...", total_posts: slots.length });

  const contentPlan = await generateContentPlan({
    context,
    trendingContext,
    localeCtx: localeCtx.skillContext,
    slots,
  });

  // ── Step B: Image Generation ──────────────────────────────────────────────
  await updateJob(serviceSupabase, jobId, { status: "generating", current_step: "Generating images...", completed_posts: 0 });

  const generatedPosts: Array<{
    slot: PostSlot;
    plan: ContentPlanPost;
    assetId?: string;
    imageUrl?: string;
    caption: string;
    hashtags: string[];
    failed: boolean;
  }> = [];

  const warnings: string[] = [];
  const BATCH_SIZE = 3;

  for (let i = 0; i < contentPlan.length; i += BATCH_SIZE) {
    const batch = contentPlan.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (planItem) => {
        const slot = slots[planItem.slotIndex];
        if (!slot) throw new Error(`Invalid slot index: ${planItem.slotIndex}`);

        const result = await generateCreativeImage({
          supabase: serviceSupabase,
          userId,
          projectId,
          campaignId,
          postContent: planItem.postConcept,
          platform: slot.platformKey,
          brandContext,
          customInstruction: `Content category: ${planItem.category}. Headline: ${planItem.headline}. ${planItem.subheadline || ""}`,
        });

        return {
          slot,
          plan: planItem,
          assetId: result.assetId,
          imageUrl: result.imageUrl,
          caption: result.caption,
          hashtags: result.hashtags,
          failed: false,
        };
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        generatedPosts.push(r.value);
      } else {
        // Find which batch item failed
        const batchIdx = results.indexOf(r);
        const planItem = batch[batchIdx];
        const slot = slots[planItem?.slotIndex ?? 0];
        if (planItem && slot) {
          generatedPosts.push({
            slot,
            plan: planItem,
            caption: planItem.headline || planItem.postConcept,
            hashtags: [],
            failed: true,
          });
          warnings.push(`Image generation failed for ${slot.platform} on ${slot.date}: ${r.reason}`);
        }
      }
    }

    // Update progress
    await updateJob(serviceSupabase, jobId, {
      completed_posts: Math.min(generatedPosts.length, slots.length),
      current_step: `Generated ${generatedPosts.length} of ${slots.length} images...`,
    });

    // Rate limit delay between batches
    if (i + BATCH_SIZE < contentPlan.length) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // ── Step C: Schedule Posts ────────────────────────────────────────────────
  await updateJob(serviceSupabase, jobId, { status: "scheduling", current_step: "Scheduling posts..." });

  // Look up connected social accounts
  const { data: socialAccounts } = await serviceSupabase
    .from("social_accounts")
    .select("id, platform, platform_username, status")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("status", "active");

  const accountsByPlatform = new Map<string, { id: string; platform_username: string }>();
  for (const acc of socialAccounts || []) {
    if (!accountsByPlatform.has(acc.platform)) {
      accountsByPlatform.set(acc.platform, { id: acc.id, platform_username: acc.platform_username });
    }
  }

  const timezone = settings.timezone || (locale === "he" ? "Asia/Jerusalem" : "America/New_York");
  let draftCount = 0;

  for (const post of generatedPosts) {
    const account = accountsByPlatform.get(post.slot.platform);
    const hasAccount = !!account;
    const status = hasAccount ? "scheduled" : "draft";

    if (!hasAccount) draftCount++;

    // Compute scheduled_at in UTC
    const localDateTimeStr = `${post.slot.date}T${post.slot.time}:00`;
    const scheduledAt = localToUTC(localDateTimeStr, timezone);

    // Create post record
    const { data: postRecord, error: postError } = await serviceSupabase
      .from("posts")
      .insert({
        user_id: userId,
        project_id: projectId,
        campaign_id: campaignId,
        campaign_asset_id: post.assetId || null,
        status,
        scheduled_at: hasAccount ? scheduledAt : null,
      })
      .select()
      .single();

    if (postError || !postRecord) {
      warnings.push(`Failed to create post for ${post.slot.platform} on ${post.slot.date}: ${postError?.message}`);
      continue;
    }

    // Create post_platform record
    const mediaUrls = post.imageUrl ? [post.imageUrl] : [];
    await serviceSupabase.from("post_platforms").insert({
      post_id: (postRecord as { id: string }).id,
      social_account_id: account?.id || null,
      platform: post.slot.platform,
      caption: post.caption || post.plan.headline,
      hashtags: post.hashtags,
      media_urls: mediaUrls,
    });
  }

  if (draftCount > 0) {
    const missingPlatforms = platforms.filter((p) => !accountsByPlatform.has(p));
    warnings.push(`No connected accounts for: ${missingPlatforms.join(", ")}. ${draftCount} posts created as drafts.`);
  }

  // Update campaign status
  await serviceSupabase
    .from("campaigns")
    .update({ status: "active" })
    .eq("id", campaignId);

  // Mark job as completed
  await updateJob(serviceSupabase, jobId, {
    status: "completed",
    current_step: "Complete",
    completed_posts: generatedPosts.length,
    metadata: { warnings, total_generated: generatedPosts.length, total_failed: generatedPosts.filter((p) => p.failed).length },
  });
}

/**
 * Use AI to generate a content plan that fills the schedule slots.
 */
async function generateContentPlan(params: {
  context: string;
  trendingContext: string;
  localeCtx: string;
  slots: PostSlot[];
}): Promise<ContentPlanPost[]> {
  const { context, trendingContext, localeCtx, slots } = params;

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const slotsJson = slots.map((s, i) => ({
    index: i,
    date: s.date,
    time: s.time,
    platform: s.platform,
  }));

  const templateCategories = getTemplateCategories();

  const prompt = `You are a content strategy expert. Given the following schedule slots and brand context, create a content plan.

BRAND INTELLIGENCE:
${context}

${trendingContext ? `CURRENT TRENDING TOPICS:\n${trendingContext}\n\nWeave timely topics into the first week of the calendar where they fit naturally.\n` : ""}
${localeCtx ? `${localeCtx}\n` : ""}

SCHEDULE SLOTS:
${JSON.stringify(slotsJson, null, 2)}

CONTENT CATEGORIES AVAILABLE:
${templateCategories}

For each slot, provide a content plan entry. Return ONLY a valid JSON array, no markdown code fences, no explanation.

Each entry:
{
  "slotIndex": <number matching the slot index>,
  "category": "<one of: promotional, educational, quote, announcement, product_showcase, testimonial>",
  "postConcept": "<detailed visual description for image generation — be specific about the scene, composition, mood>",
  "headline": "<short headline text for the post, 5-10 words>",
  "subheadline": "<supporting text, 10-20 words>"
}

Rules:
- Mix categories for variety: ~25% educational, ~25% product_showcase, ~15% promotional, ~15% quote, ~10% announcement, ~10% testimonial
- Each postConcept must be unique and specific enough to generate a distinct image
- Match content to the platform (e.g. Instagram = visual lifestyle, Twitter = punchy/short, TikTok = dynamic/trendy)
- Weave trending topics naturally where relevant
- Headlines should be engaging, not generic
- Return exactly ${slots.length} entries, one per slot`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Parse JSON — strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as ContentPlanPost[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Empty content plan");
    }

    // Validate and fix template IDs
    return parsed.map((p, i) => ({
      slotIndex: p.slotIndex ?? i,
      category: p.category || "educational",
      templateId: findTemplateId(p.category || "educational", slots[p.slotIndex ?? i]?.platformKey || "instagram_feed"),
      postConcept: p.postConcept || `Brand content for ${slots[i]?.platform || "social media"}`,
      headline: p.headline || "Check this out",
      subheadline: p.subheadline || "",
    }));
  } catch {
    // Retry once with a simpler prompt
    const retryResult = await model.generateContent(
      `Generate a JSON array with ${slots.length} content plan entries. Each entry has: slotIndex (number 0 to ${slots.length - 1}), category (string: promotional/educational/quote/product_showcase), postConcept (detailed image description), headline (short text), subheadline (supporting text). Return ONLY valid JSON array, nothing else.`
    );
    const retryText = retryResult.response.text().trim();
    const retryCleaned = retryText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const retryParsed = JSON.parse(retryCleaned) as ContentPlanPost[];

    return retryParsed.map((p, i) => ({
      slotIndex: p.slotIndex ?? i,
      category: p.category || "educational",
      templateId: findTemplateId(p.category || "educational", slots[p.slotIndex ?? i]?.platformKey || "instagram_feed"),
      postConcept: p.postConcept || `Brand content for ${slots[i]?.platform || "social media"}`,
      headline: p.headline || "Check this out",
      subheadline: p.subheadline || "",
    }));
  }
}

/**
 * Convert a local datetime string to UTC ISO string.
 */
function localToUTC(localDateTimeStr: string, timezone: string): string {
  try {
    // Create a Date object by interpreting the local time in the given timezone
    // Use Intl.DateTimeFormat to find the offset
    const date = new Date(localDateTimeStr);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    // Get the timezone offset by comparing local formatted time
    const utcDate = new Date(localDateTimeStr + "Z");
    const localParts = formatter.formatToParts(utcDate);
    const getP = (type: string) => localParts.find((p) => p.type === type)?.value || "0";
    const localInTz = new Date(`${getP("year")}-${getP("month")}-${getP("day")}T${getP("hour")}:${getP("minute")}:${getP("second")}Z`);

    const offsetMs = localInTz.getTime() - utcDate.getTime();
    const targetUtc = new Date(date.getTime() - offsetMs);

    return targetUtc.toISOString();
  } catch {
    // Fallback: treat as UTC
    return new Date(localDateTimeStr).toISOString();
  }
}
