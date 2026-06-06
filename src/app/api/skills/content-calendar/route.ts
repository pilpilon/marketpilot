import { NextResponse, after } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseProjectSettings, buildLocaleContext } from "@/lib/ai/locale-context";
import { researchTrendingTopics } from "@/lib/ai/trending-research";
import { loadBrandContext } from "@/lib/templates/brand-tokens";
import { buildScheduleSlots, type TimeRange, type PostSlot } from "@/lib/skills/schedule-builder";
import { renderTemplateImage } from "@/lib/templates/render-template-image";
import { findSystemTemplate, SYSTEM_TEMPLATES } from "@/lib/templates/system-templates";
import { PLATFORM_RATIOS } from "@/lib/templates/dimensions";
import { generateSocialCaption } from "@/lib/ai/caption-generation";
import type { ContentTemplate, TemplateField } from "@/types/templates";

export const maxDuration = 300;

type BrandContext = Awaited<ReturnType<typeof loadBrandContext>>;

const VALID_TIME_RANGES: TimeRange[] = ["1_week", "2_weeks", "3_weeks", "1_month"];

type CalendarTemplateMode = "auto" | "single" | "carousel" | "selected";

interface ContentCalendarOptions {
  templateMode: CalendarTemplateMode;
  templateId?: string;
  allowCarousels: boolean;
}

interface ContentPlanPost {
  slotIndex: number;
  category: string;
  templateId?: string;
  postConcept: string;
  painPoint?: string;
  audienceMoment?: string;
  headline: string;
  subheadline: string;
  cta: string;
  slideCopy?: Array<{ headline: string; subheadline: string; cta?: string }>;
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

function buildProjectIntelligenceBrief(files: Array<{ file_type: string; content: string }>): string {
  const priority = ["brand", "product", "audience", "features", "sop", "competitors", "intake", "examples", "visual_style", "character_brief"];
  const sorted = [...files].sort((a, b) => {
    const ai = priority.indexOf(a.file_type);
    const bi = priority.indexOf(b.file_type);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return sorted
    .map((file) => {
      const label = file.file_type.replace(/_/g, " ").toUpperCase();
      const cleaned = file.content.replace(/\s+$/gm, "").trim();
      return `## ${label}\n${cleaned.slice(0, 1800)}`;
    })
    .join("\n\n---\n\n")
    .slice(0, 12000);
}

function genericFallbackSlideCopy(plan: Pick<ContentPlanPost, "headline" | "subheadline" | "cta" | "painPoint">) {
  return [
    {
      headline: plan.headline || "Stop Losing Time",
      subheadline: plan.painPoint || plan.subheadline || "A specific audience problem is costing more than it seems",
      cta: "",
    },
    {
      headline: "The Hidden Cost",
      subheadline: "Show the consequence, friction, or missed opportunity behind the problem",
      cta: "",
    },
    {
      headline: plan.cta || "See How",
      subheadline: plan.subheadline || "Connect the product mechanism to a concrete audience benefit",
      cta: plan.cta || "",
    },
  ];
}

interface StrategyPreview {
  targetAudience: string;
  productMechanism: string;
  campaignThesis: string;
  painPoints: string[];
  hookAngles: string[];
  proofPoints: string[];
  visualDirections: string[];
  postPreviews: Array<{
    slotIndex: number;
    platform?: string;
    headline: string;
    painPoint: string;
    hookAngle: string;
  }>;
}

interface QualityGateResult {
  passed: boolean;
  score: number;
  summary: string;
  diagnostics: string[];
  rejectedPosts: Array<{ slotIndex: number; score: number; reasons: string[] }>;
}

interface TemporalContext {
  nowIso: string;
  currentYear: number;
  currentMonth: number;
  currentDateLabel: string;
  upcomingEvents: string[];
  staleEventExamples: string[];
}

function buildTemporalContext(now = new Date(), market?: string): TemporalContext {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const upcomingEvents: string[] = [];

  // Keep a tiny deterministic calendar for high-impact cultural moments that
  // generic models often get wrong. This is not a trends substitute; it is a
  // temporal guardrail so prompts and gates know what "current" means.
  const worldCup2026Start = new Date("2026-06-11T00:00:00Z");
  const worldCup2026End = new Date("2026-07-19T23:59:59Z");
  if (now >= new Date("2026-05-25T00:00:00Z") && now <= worldCup2026End) {
    const daysUntil = Math.ceil((worldCup2026Start.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    if (daysUntil > 1) {
      upcomingEvents.push(`FIFA World Cup 2026 starts in ${daysUntil} days; for ${market === "IL" ? "Israeli/Hebrew" : "local"} restaurant/bar content, use World Cup 2026 match-night demand if event-led hooks are useful.`);
    } else if (daysUntil >= 0) {
      upcomingEvents.push(`FIFA World Cup 2026 starts this week; for ${market === "IL" ? "Israeli/Hebrew" : "local"} restaurant/bar content, use World Cup 2026 match-night demand if event-led hooks are useful.`);
    } else {
      upcomingEvents.push("FIFA World Cup 2026 is currently running; use current match-night demand only where relevant.");
    }
  }

  return {
    nowIso: now.toISOString(),
    currentYear,
    currentMonth,
    currentDateLabel: now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    upcomingEvents,
    staleEventExamples: ["Euro 2024", "יורו 2024", "Euro 2004", "יורו 2004"],
  };
}

function buildTemporalPromptBlock(ctx: TemporalContext): string {
  return `CURRENT DATE / TEMPORAL RELEVANCE:\n- Today is ${ctx.currentDateLabel} (${ctx.nowIso}); current year is ${ctx.currentYear}.\n- Treat events from previous years as stale unless explicitly framed as history/recap.\n- Never describe past events as upcoming/current. Specifically reject: ${ctx.staleEventExamples.join(", ")}.\n${ctx.upcomingEvents.length ? `- Current/upcoming relevant events you MAY use if naturally relevant: ${ctx.upcomingEvents.join(" ")}` : "- If no current event is provided by project intelligence or trends, do not invent one."}\n- If you use a timely hook, it must match the slot dates below and the current year.`;
}

function findStaleTemporalReferences(text: string, ctx: TemporalContext): string[] {
  const findings = new Set<string>();
  const normalized = text.toLowerCase();

  for (const example of ctx.staleEventExamples) {
    if (normalized.includes(example.toLowerCase())) findings.add(example);
  }

  const eventYearRegexes = [
    /\b(?:euro|uefa euro|world cup|fifa world cup|olympics|olympic games)\s*(20\d{2})\b/gi,
    /\b(?:יורו|מונדיאל|גביע העולם|אולימפיאדה)\s*(20\d{2})\b/gi,
  ];

  for (const regex of eventYearRegexes) {
    for (const match of text.matchAll(regex)) {
      const year = Number(match[1]);
      if (Number.isFinite(year) && year < ctx.currentYear) {
        findings.add(match[0]);
      }
    }
  }

  return Array.from(findings);
}

function temporalReplacementFor(text: string, ctx: TemporalContext): string {
  const hasHebrew = /[\u0590-\u05FF]/.test(text);
  if (ctx.currentYear === 2026) {
    return hasHebrew ? "מונדיאל 2026" : "FIFA World Cup 2026";
  }
  return hasHebrew ? `אירוע רלוונטי ב-${ctx.currentYear}` : `a current ${ctx.currentYear} event`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeTemporalReferencesInText(value: string | undefined, ctx: TemporalContext): string | undefined {
  if (!value) return value;
  let sanitized = value;
  const replacement = temporalReplacementFor(value, ctx);
  const hashtagReplacement = `#${replacement.replace(/\s+/g, "")}`;

  for (const example of ctx.staleEventExamples) {
    sanitized = sanitized.replace(new RegExp(escapeRegExp(example), "gi"), replacement);
  }

  sanitized = sanitized
    .replace(/#(?:Euro|UEFAEuro)\s*20\d{2}\b/gi, hashtagReplacement)
    .replace(/#יורו\s*20\d{2}\b/gi, hashtagReplacement)
    .replace(/\b(?:euro|uefa euro)\s*20\d{2}\b/gi, replacement)
    .replace(/\bיורו\s*20\d{2}\b/gi, replacement);

  return sanitized;
}

function sanitizeContentPlanTemporalReferences(
  contentPlan: ContentPlanPost[],
  ctx: TemporalContext
): { plan: ContentPlanPost[]; findings: string[] } {
  const findings = new Set<string>();
  const plan = contentPlan.map((post) => {
    const textBlob = [
      post.headline,
      post.subheadline,
      post.cta,
      post.painPoint,
      post.audienceMoment,
      post.postConcept,
      ...(post.slideCopy || []).flatMap((slide) => [slide.headline, slide.subheadline, slide.cta]),
    ]
      .filter(Boolean)
      .join(" ");

    for (const finding of findStaleTemporalReferences(textBlob, ctx)) findings.add(finding);

    return {
      ...post,
      headline: sanitizeTemporalReferencesInText(post.headline, ctx) || post.headline,
      subheadline: sanitizeTemporalReferencesInText(post.subheadline, ctx) || post.subheadline,
      cta: sanitizeTemporalReferencesInText(post.cta, ctx) || post.cta,
      painPoint: sanitizeTemporalReferencesInText(post.painPoint, ctx),
      audienceMoment: sanitizeTemporalReferencesInText(post.audienceMoment, ctx),
      postConcept: sanitizeTemporalReferencesInText(post.postConcept, ctx) || post.postConcept,
      slideCopy: post.slideCopy?.map((slide) => ({
        headline: sanitizeTemporalReferencesInText(slide.headline, ctx) || slide.headline,
        subheadline: sanitizeTemporalReferencesInText(slide.subheadline, ctx) || slide.subheadline,
        cta: sanitizeTemporalReferencesInText(slide.cta, ctx),
      })),
    };
  });

  return { plan, findings: Array.from(findings) };
}

function uniqueStrings(values: Array<string | undefined>, max = 8): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = (value || "").trim();
    if (!cleaned || seen.has(cleaned.toLowerCase())) continue;
    seen.add(cleaned.toLowerCase());
    result.push(cleaned);
    if (result.length >= max) break;
  }
  return result;
}

function buildStrategyPreview(
  contentPlan: ContentPlanPost[],
  slots: PostSlot[],
  brandContext: BrandContext
): StrategyPreview {
  const painPoints = uniqueStrings(contentPlan.map((p) => p.painPoint), 8);
  const hookAngles = uniqueStrings(contentPlan.map((p) => p.headline), 8);
  const visualDirections = uniqueStrings(contentPlan.map((p) => p.postConcept), 6);
  const proofPoints = uniqueStrings([
    brandContext.brandPositioning,
    brandContext.productContext,
    brandContext.features.slice(0, 500),
    ...contentPlan.map((p) => p.subheadline),
  ], 6);

  return {
    targetAudience: brandContext.audienceContext || "Audience inferred from project intelligence",
    productMechanism: brandContext.productContext || "Product mechanism inferred from project intelligence",
    campaignThesis: `Use pain-led hooks to connect ${painPoints.slice(0, 3).join(" / ") || "audience problems"} to the product's mechanism and proof.`,
    painPoints,
    hookAngles,
    proofPoints,
    visualDirections,
    postPreviews: contentPlan.slice(0, 12).map((post) => ({
      slotIndex: post.slotIndex,
      platform: slots[post.slotIndex]?.platform,
      headline: post.headline,
      painPoint: post.painPoint || "",
      hookAngle: post.slideCopy?.[0]?.headline || post.headline,
    })),
  };
}

function evaluateContentPlanQuality(contentPlan: ContentPlanPost[], temporalContext: TemporalContext): QualityGateResult {
  const genericPhrases = [
    "check this out",
    "brand content",
    "general marketing",
    "specific audience pain from project intelligence",
    "fix the hidden pain",
    "target audience facing the problem",
    "show the audience a concrete problem",
    "lorem ipsum",
  ];
  const rejectedPosts: QualityGateResult["rejectedPosts"] = [];
  const diagnostics: string[] = [];
  let totalScore = 0;

  for (const post of contentPlan) {
    const textBlob = [
      post.headline,
      post.subheadline,
      post.painPoint,
      post.audienceMoment,
      post.postConcept,
      ...(post.slideCopy || []).flatMap((slide) => [slide.headline, slide.subheadline, slide.cta]),
    ]
      .filter(Boolean)
      .join(" ")
    const lowercaseTextBlob = textBlob.toLowerCase();
    const reasons: string[] = [];
    let score = 100;

    if (!post.painPoint || post.painPoint.trim().length < 12) {
      score -= 22;
      reasons.push("missing specific pain point");
    }
    if (!post.audienceMoment || post.audienceMoment.trim().length < 18) {
      score -= 16;
      reasons.push("missing concrete audience moment");
    }
    if (!post.postConcept || post.postConcept.trim().length < 70) {
      score -= 18;
      reasons.push("visual concept is too thin");
    }
    if (!post.slideCopy || post.slideCopy.length < 3) {
      score -= 22;
      reasons.push("carousel script needs 3 distinct slides");
    } else {
      const distinctSlideHeads = new Set(post.slideCopy.map((s) => (s.headline || "").trim().toLowerCase()).filter(Boolean));
      if (distinctSlideHeads.size < 3) {
        score -= 16;
        reasons.push("slide hooks repeat instead of building a story");
      }
    }
    if (post.headline.length > 60 || post.headline.split(/\s+/).length > 8) {
      score -= 10;
      reasons.push("headline is not hook-short");
    }
    if (genericPhrases.some((phrase) => lowercaseTextBlob.includes(phrase))) {
      score -= 30;
      reasons.push("contains generic fallback language");
    }
    const staleTemporalReferences = findStaleTemporalReferences(textBlob, temporalContext);
    if (staleTemporalReferences.length > 0) {
      score -= 45;
      reasons.push(`stale/outdated event reference: ${staleTemporalReferences.join(", ")}`);
    }

    totalScore += Math.max(0, score);
    if (score < 65 || reasons.length >= 3) {
      rejectedPosts.push({ slotIndex: post.slotIndex, score: Math.max(0, score), reasons });
    }
  }

  const averageScore = contentPlan.length ? Math.round(totalScore / contentPlan.length) : 0;
  if (contentPlan.length === 0) diagnostics.push("No content plan entries generated");
  if (rejectedPosts.length > 0) diagnostics.push(`${rejectedPosts.length} posts failed the pre-render quality gate`);
  if (averageScore < 78) diagnostics.push(`Average strategy quality score is ${averageScore}, below 78`);

  const passed = contentPlan.length > 0 && rejectedPosts.length === 0 && averageScore >= 78;
  return {
    passed,
    score: averageScore,
    summary: passed
      ? `Strategy approved (${averageScore}/100): hooks, pains, visuals, and carousel scripts are specific enough to render.`
      : `Strategy rejected (${averageScore}/100): improve hooks, pain specificity, visual concepts, or slide scripts before rendering.`,
    diagnostics,
    rejectedPosts,
  };
}

/** Build the available template categories string for the AI prompt */
function getTemplateCategories(options: ContentCalendarOptions): string {
  const categories = new Map<string, string>();
  for (const t of SYSTEM_TEMPLATES) {
    if (!isTemplateAllowedForCalendar(t, options, "instagram_feed")) continue;
    const formatLabel = t.format === "carousel" ? "carousel" : "single";
    if (!categories.has(t.category)) {
      categories.set(t.category, `${t.description} (${formatLabel} templates available)`);
    }
  }
  return Array.from(categories.entries())
    .map(([cat, desc]) => `- ${cat}: ${desc}`)
    .join("\n");
}

function isTemplateAllowedForCalendar(
  template: ContentTemplate,
  options: ContentCalendarOptions,
  platformKey: string
): boolean {
  if (!template.platforms.includes(platformKey) && !template.platforms.includes("instagram_feed")) {
    return false;
  }
  if (options.templateMode === "selected") return template.id === options.templateId;
  if (options.templateMode === "carousel") return template.format === "carousel";
  if (options.templateMode === "single") return template.format === "single";
  if (!options.allowCarousels && template.format === "carousel") return false;
  return true;
}

/** Resolve the best Creative Designer template for a calendar plan. */
function resolveTemplateForPlan(
  plan: Pick<ContentPlanPost, "category" | "templateId">,
  platformKey: string,
  options: ContentCalendarOptions
): ContentTemplate {
  const selected = options.templateId ? findSystemTemplate(options.templateId) : undefined;
  if (selected && isTemplateAllowedForCalendar(selected, options, platformKey)) return selected;

  const planned = plan.templateId ? findSystemTemplate(plan.templateId) : undefined;
  if (planned && isTemplateAllowedForCalendar(planned, options, platformKey)) return planned;

  const candidates = SYSTEM_TEMPLATES.filter((t) => isTemplateAllowedForCalendar(t, options, platformKey));
  const sameCategory = candidates.find((t) => t.category === plan.category);
  if (sameCategory) return sameCategory;

  const platformMatch = candidates.find((t) => t.platforms.includes(platformKey));
  if (platformMatch) return platformMatch;

  const fallback = candidates[0] || SYSTEM_TEMPLATES.find((t) => t.id === "sys-promo-bottom-bar");
  if (!fallback) throw new Error("No content templates are available");
  return fallback;
}

function clampField(value: string, field: TemplateField): string {
  const fallback = field.defaultValue || "";
  const raw = (value || fallback || "").trim();
  if (!field.maxLength || raw.length <= field.maxLength) return raw;
  return raw.slice(0, Math.max(0, field.maxLength - 1)).trimEnd() + "…";
}

function buildFieldValue(field: TemplateField, plan: ContentPlanPost, template: ContentTemplate, slideIndex: number): string {
  const id = field.id.toLowerCase();
  const slidePlan = plan.slideCopy?.[slideIndex];
  const slideRole = template.slides[slideIndex]?.role;
  const isCtaSlide = slideRole === "cta";
  const headline = slidePlan?.headline || (isCtaSlide ? (plan.cta || plan.headline) : plan.headline);
  const subheadline = slidePlan?.subheadline || plan.subheadline || plan.painPoint || plan.postConcept;
  const cta = slidePlan?.cta || plan.cta || defaultCtaForCategory(plan.category);

  if (["headline", "title", "hook", "quote", "stat"].includes(id)) {
    return clampField(headline, field);
  }
  if (["subheadline", "subtitle", "body", "description", "detail", "point", "value"].includes(id)) {
    return clampField(subheadline, field);
  }
  if (id === "cta") return clampField(cta, field);
  if (id === "attribution") return clampField(subheadline, field);
  return clampField(subheadline || headline, field);
}

/** Fill the actual Creative Designer template slides/fields for a calendar item. */
function buildTemplateSlides(template: ContentTemplate, plan: ContentPlanPost) {
  return template.slides.map((slide, slideIndex) => ({
    slideId: slide.id,
    fieldValues: Object.fromEntries(
      slide.fields.map((field) => [field.id, buildFieldValue(field, plan, template, slideIndex)])
    ),
  }));
}

/** Default CTA text when the AI doesn't provide one */
function defaultCtaForCategory(category: string): string {
  const map: Record<string, string> = {
    promotional: "Shop Now",
    product_showcase: "Learn More",
    announcement: "Stay Tuned",
    educational: "",
    quote: "",
    testimonial: "",
  };
  return map[category] || "";
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    projectId,
    platforms,
    timeRange,
    format = "feed",
    campaignName,
    templateMode = "auto",
    templateId,
    allowCarousels = templateMode === "carousel",
  } = body as {
    projectId: string;
    platforms: string[];
    timeRange: TimeRange;
    format?: string;
    campaignName?: string;
    templateMode?: CalendarTemplateMode;
    templateId?: string;
    allowCarousels?: boolean;
  };

  const calendarOptions: ContentCalendarOptions = {
    templateMode,
    templateId,
    allowCarousels: Boolean(allowCarousels || templateMode === "carousel" || format === "carousel"),
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
        format,
        calendarOptions,
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
  supabase: SupabaseClient,
  jobId: string,
  updates: Record<string, unknown>
) {
  await supabase
    .from("pipeline_jobs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

async function runPipeline(params: {
  serviceSupabase: SupabaseClient;
  userId: string;
  projectId: string;
  campaignId: string;
  jobId: string;
  platforms: string[];
  timeRange: TimeRange;
  format: string;
  calendarOptions: ContentCalendarOptions;
  projectSettings: unknown;
}) {
  const { serviceSupabase, userId, projectId, campaignId, jobId, platforms, timeRange, format, calendarOptions, projectSettings } = params;

  // ── Step A: Planning ──────────────────────────────────────────────────────
  await updateJob(serviceSupabase, jobId, { status: "planning", current_step: "Loading brand intelligence..." });

  const settings = parseProjectSettings(projectSettings);
  const localeCtx = buildLocaleContext(settings);
  const locale = settings.locale || "en";
  const temporalContext = buildTemporalContext(new Date(), settings.market);

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

  // Research trending topics
  await updateJob(serviceSupabase, jobId, { current_step: "Researching trending topics..." });
  const niche = extractNiche(contextFiles as Array<{ file_type: string; content: string }>);
  const trendingContext = await researchTrendingTopics(niche, settings.market);

  // Build schedule slots — start after the last existing scheduled post to avoid overlap
  await updateJob(serviceSupabase, jobId, { current_step: "Building posting schedule..." });

  const { data: lastPost } = await serviceSupabase
    .from("posts")
    .select("scheduled_at")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .in("status", ["scheduled", "publishing"])
    .not("scheduled_at", "is", null)
    .order("scheduled_at", { ascending: false })
    .limit(1)
    .single();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1); // Default: tomorrow

  if (lastPost?.scheduled_at) {
    const lastScheduled = new Date(lastPost.scheduled_at);
    const tomorrow = new Date(startDate);
    if (lastScheduled > tomorrow) {
      // Start the day after the last scheduled post
      startDate.setTime(lastScheduled.getTime());
      startDate.setDate(startDate.getDate() + 1);
      startDate.setHours(0, 0, 0, 0);
    }
  }

  const scheduleFormat = format === "carousel" ? "feed" : format;
  const slots = buildScheduleSlots({
    platforms,
    timeRange,
    startDate,
    locale: locale as "en" | "he",
    format: scheduleFormat,
  });

  if (slots.length === 0) {
    throw new Error("No schedule slots could be generated");
  }

  // Generate content plan with AI
  await updateJob(serviceSupabase, jobId, { current_step: "Planning content themes...", total_posts: slots.length });

  const contentPlan = await generateContentPlan({
    brandContext,
    trendingContext,
    localeCtx: localeCtx.skillContext,
    locale,
    slots,
    calendarOptions,
    projectIntelligence: buildProjectIntelligenceBrief(contextFiles as Array<{ file_type: string; content: string }>),
    temporalContext,
  });

  // ── Strategy Preview + Quality Gate ───────────────────────────────────────
  await updateJob(serviceSupabase, jobId, { current_step: "Reviewing strategy quality before rendering..." });
  const strategyPreview = buildStrategyPreview(contentPlan, slots, brandContext);
  const qualityGate = evaluateContentPlanQuality(contentPlan, temporalContext);

  await updateJob(serviceSupabase, jobId, {
    metadata: { strategyPreview, qualityGate },
  });

  if (!qualityGate.passed) {
    throw new Error(`${qualityGate.summary} ${qualityGate.diagnostics.join(" ")}`.trim());
  }

  // ── Step B: Template Rendering ────────────────────────────────────────────
  await updateJob(serviceSupabase, jobId, { status: "generating", current_step: "Rendering template images...", completed_posts: 0 });

  const generatedPosts: Array<{
    slot: PostSlot;
    plan: ContentPlanPost;
    assetId?: string;
    imageUrls: string[];
    carouselGroupId?: string | null;
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

        // ── Build field values from content plan ──
        const template = resolveTemplateForPlan(planItem, slot.platformKey, calendarOptions);
        const templateSlides = buildTemplateSlides(template, planItem);

        // ── Render Creative Designer template image(s) ──
        const rendered = await renderTemplateImage({
          supabase: serviceSupabase,
          projectId,
          templateId: template.id,
          platform: slot.platformKey,
          slides: templateSlides,
          customInstruction: planItem.postConcept,
        });

        if (!rendered.length) {
          throw new Error(`No slides rendered for template ${template.id}`);
        }

        const carouselGroupId = template.format === "carousel" && rendered.length > 1 ? crypto.randomUUID() : null;
        const imageUrls: string[] = [];
        const assetIds: string[] = [];

        // ── Upload each rendered slide to storage and save an asset row ──
        for (let slideIndex = 0; slideIndex < rendered.length; slideIndex++) {
          const renderedSlide = rendered[slideIndex];
          const slideDef = template.slides.find((s) => s.id === renderedSlide.slideId) || template.slides[slideIndex];
          const fileName = `${userId}/${projectId}/${Date.now()}-${template.id}-${renderedSlide.slideId}-${slot.platformKey}.jpg`;
          const { error: uploadError } = await serviceSupabase.storage
            .from("generated-images")
            .upload(fileName, renderedSlide.imageBuffer, { contentType: "image/jpeg", upsert: false });

          if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

          const { data: urlData } = serviceSupabase.storage
            .from("generated-images")
            .getPublicUrl(fileName);

          imageUrls.push(urlData.publicUrl);

          const { data: asset, error: assetError } = await serviceSupabase
            .from("campaign_assets")
            .insert({
              campaign_id: campaignId,
              user_id: userId,
              asset_type: "template_render",
              title: `${slot.platform} ${template.format === "carousel" ? "carousel" : "visual"}`,
              content: planItem.postConcept,
              storage_path: urlData.publicUrl,
              carousel_group_id: carouselGroupId,
              slide_order: slideIndex,
              metadata: {
                template_id: template.id,
                slide_id: renderedSlide.slideId,
                platform: slot.platformKey,
                aspect_ratio: PLATFORM_RATIOS[slot.platformKey] || "1:1",
                category: template.category,
                template_format: template.format,
                overlay_style: slideDef?.overlayStyle,
                mime_type: "image/jpeg",
                file_name: fileName,
              },
              status: "draft",
            })
            .select()
            .single();

          if (assetError) throw new Error(`Asset creation failed: ${assetError.message}`);
          assetIds.push((asset as { id: string }).id);
        }

        // ── Generate caption + hashtags ──
        let generatedCaption = "";
        let generatedHashtags: string[] = [];

        try {
          const captionResult = await generateSocialCaption({
            brandContext,
            postConcept: planItem.postConcept,
            headline: planItem.headline,
            platform: slot.platformKey,
            localeContext: localeCtx.skillContext,
            captionLength: "standard",
          });
          generatedCaption = sanitizeTemporalReferencesInText(captionResult.caption, temporalContext) || captionResult.caption;
          generatedHashtags = captionResult.hashtags
            .map((tag) => sanitizeTemporalReferencesInText(tag, temporalContext) || tag)
            .map((tag) => tag.replace(/^#/, "").replace(/\s+/g, ""))
            .filter(Boolean);
        } catch {
          // Caption generation is best-effort
        }

        if (generatedCaption || generatedHashtags.length > 0) {
          for (const assetId of assetIds) {
            const { data: slideAsset } = await serviceSupabase
              .from("campaign_assets")
              .select("metadata")
              .eq("id", assetId)
              .single();

            await serviceSupabase
              .from("campaign_assets")
              .update({
                metadata: {
                  ...((slideAsset?.metadata as Record<string, unknown>) || {}),
                  ...(generatedCaption && { caption: generatedCaption }),
                  ...(generatedHashtags.length > 0 && { hashtags: generatedHashtags }),
                },
              })
              .eq("id", assetId);
          }
        }

        return {
          slot,
          plan: { ...planItem, templateId: template.id },
          assetId: assetIds[0],
          imageUrls,
          carouselGroupId,
          caption: generatedCaption || planItem.headline,
          hashtags: generatedHashtags,
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
            imageUrls: [],
            carouselGroupId: null,
            caption: planItem.headline || planItem.postConcept,
            hashtags: [],
            failed: true,
          });
          warnings.push(`Template rendering failed for ${slot.platform} on ${slot.date}: ${r.reason}`);
        }
      }
    }

    // Update progress
    await updateJob(serviceSupabase, jobId, {
      completed_posts: Math.min(generatedPosts.length, slots.length),
      current_step: `Rendered ${generatedPosts.length} of ${slots.length} posts...`,
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
    const mediaUrls = post.imageUrls;
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
    metadata: {
      warnings,
      total_generated: generatedPosts.length,
      total_failed: generatedPosts.filter((p) => p.failed).length,
      strategyPreview,
      qualityGate,
    },
  });
}

/**
 * Use AI to generate a content plan that fills the schedule slots.
 */
async function generateContentPlan(params: {
  brandContext: BrandContext;
  trendingContext: string;
  localeCtx: string;
  locale: string;
  slots: PostSlot[];
  calendarOptions: ContentCalendarOptions;
  projectIntelligence: string;
  temporalContext: TemporalContext;
}): Promise<ContentPlanPost[]> {
  const { brandContext, trendingContext, localeCtx, locale, slots, calendarOptions, projectIntelligence, temporalContext } = params;

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

  const templateCategories = getTemplateCategories(calendarOptions);
  const lang = locale === "he" ? "Hebrew" : "English";

  const prompt = `You are a content strategy expert creating a content calendar for a specific brand. Use the brand intelligence below to write content that sounds like this brand — not generic marketing.

BRAND VOICE & PERSONALITY:
${brandContext.brandPersonality || "professional, engaging, modern"}

Write ALL headlines, subheadlines, and CTAs in this voice. Be consistent with the brand's tone throughout.

TARGET AUDIENCE:
${brandContext.audienceContext || "general consumers"}

Every post must resonate with these specific people. Reference their pain points, aspirations, and language.

PRODUCT / SERVICE:
${brandContext.productContext || "the brand's product"}

Reference specific features, benefits, and use cases — not generic claims. The audience should recognize what this product does for them.

BRAND POSITIONING:
${brandContext.brandPositioning || ""}
${brandContext.visual.styleKeywords ? `\nVISUAL STYLE: ${brandContext.visual.styleKeywords}` : ""}

PROJECT INTELLIGENCE SOURCE OF TRUTH:
${projectIntelligence}

${brandContext.intakePatterns ? `PROVEN CONTENT PATTERNS (from past successful posts — follow these):\n${brandContext.intakePatterns}\n` : ""}
${buildTemporalPromptBlock(temporalContext)}

${trendingContext ? `CURRENT TRENDING TOPICS:\n${trendingContext}\n\nWeave timely topics into the first week where they fit naturally.\n` : ""}
${localeCtx || ""}

LANGUAGE: All headlines, subheadlines, CTAs, and text MUST be written in ${lang}.

SCHEDULE SLOTS:
${JSON.stringify(slotsJson, null, 2)}

CONTENT CATEGORIES AVAILABLE:
${templateCategories}

For each slot, provide a content plan entry. Return ONLY a valid JSON array, no markdown code fences, no explanation.

Each entry:
{
  "slotIndex": <number matching the slot index>,
  "category": "<one of: promotional, educational, quote, announcement, product_showcase, testimonial>",
  "painPoint": "<specific customer pain this post attacks>",
  "audienceMoment": "<real moment in the target audience's day when the pain, desire, objection, or trigger appears>",
  "postConcept": "<detailed visual scene derived from this project's intelligence: audience, product proof, usage context, before/after moment, or transformation. Avoid generic laptops, charts, office desks, stock-photo people, and random lifestyle imagery unless the project intelligence makes them specifically relevant. DO NOT include text in the generated image; template overlays add text>",
  "headline": "<3-6 words, punchy, in ${lang}>",
  "subheadline": "<8-15 words supporting the headline, in ${lang}>",
  "cta": "<short call to action, 2-4 words in ${lang}. For educational/quote categories, use empty string>",
  "slideCopy": [
    { "headline": "<slide 1 hook>", "subheadline": "<pain/problem>", "cta": "" },
    { "headline": "<slide 2 proof/insight>", "subheadline": "<why it costs money/time>", "cta": "" },
    { "headline": "<slide 3 solution/CTA>", "subheadline": "<how the product helps>", "cta": "<CTA if relevant>" }
  ]
}

Rules:
- Write like a performance marketer and viral strategist, not a generic content bot. Every creative must attack a specific audience pain, desire, objection, misconception, costly mistake, or status trigger found in PROJECT INTELLIGENCE.
- First infer the project's ICP, job-to-be-done, emotional stakes, product mechanism, proof points, objections, and competitor alternatives from PROJECT INTELLIGENCE. Then generate the posts from that inferred strategy.
- Do not import examples from another industry. If a pain point, feature, audience, or claim is not supported by PROJECT INTELLIGENCE, do not invent it.
- Mix categories for variety: ~35% educational/problem-aware, ~30% product_showcase/mechanism, ~20% promotional/CTA, ~10% testimonial/proof, ~5% announcement/news. Avoid empty quote posts unless quotes are clearly a proven content pattern for this project.
- Each postConcept must describe a concrete visual scene for background/supporting image generation — no text, logos, or fake UI in the generated image. Prefer real product proof, usage context, customer moment, before/after contrast, or a symbolic visual directly tied to the pain.
- Headlines must be 3-6 words MAX — short, punchy, brand-aligned, and hook-driven. Never append slide numbers or numeric suffixes to headlines.
- Use viral hook patterns where appropriate: costly mistake, hidden cost, before/after, contrarian truth, myth-busting, checklist, proof, comparison, urgency, founder insight, customer confession.
- slideCopy must contain 3 distinct slide messages: hook/pain → consequence/proof/insight → product mechanism/CTA. Do not repeat the same headline.
- Reference specific product features, proof points, audience language, and benefits from PROJECT INTELLIGENCE — never write generic "check this out" copy.
- Match content to the platform (Instagram/Facebook = visual proof + emotional clarity, Twitter/X = punchy insight/opinion, TikTok/Reels = fast tension + payoff, LinkedIn = professional pain + proof).
- Weave trending/current topics naturally only where relevant to this exact project. Temporal accuracy is mandatory: do not mention stale events like Euro 2024/יורו 2024 as current in ${temporalContext.currentYear}.
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

    // Validate/fix template IDs, then hard-sanitize stale temporal references.
    const normalized = parsed.map((p, i) => ({
      slotIndex: p.slotIndex ?? i,
      category: p.category || "educational",
      templateId: resolveTemplateForPlan(
        { category: p.category || "educational", templateId: p.templateId },
        slots[p.slotIndex ?? i]?.platformKey || "instagram_feed",
        calendarOptions
      ).id,
      postConcept: p.postConcept || `Brand content for ${slots[i]?.platform || "social media"}`,
      painPoint: p.painPoint || "specific audience pain from project intelligence",
      audienceMoment: p.audienceMoment || "target audience facing the problem this product solves",
      headline: p.headline || "Fix The Hidden Pain",
      subheadline: p.subheadline || p.painPoint || "Show the audience a concrete problem and the product mechanism that solves it",
      cta: p.cta || "",
      slideCopy: Array.isArray(p.slideCopy) && p.slideCopy.length > 0
        ? p.slideCopy
        : [
            ...genericFallbackSlideCopy({
              headline: p.headline,
              subheadline: p.subheadline,
              cta: p.cta,
              painPoint: p.painPoint,
            }),
          ],
    }));
    return sanitizeContentPlanTemporalReferences(normalized, temporalContext).plan;
  } catch {
    // Retry once with a simpler prompt
    const retryResult = await model.generateContent(
      `Generate a JSON array with ${slots.length} content plan entries using this project's intelligence only: ${projectIntelligence.slice(0, 4000)}\n\n${buildTemporalPromptBlock(temporalContext)}\n\nEach entry has: slotIndex, category, painPoint, audienceMoment, postConcept (specific visual scene, no text), headline, subheadline, cta, and slideCopy array with 3 distinct objects: headline/subheadline/cta. Use specific audience pain points, hooks, proof, objections, and product mechanisms from the intelligence. Do not import another industry's examples. Do not mention stale events like Euro 2024/יורו 2024 as current in ${temporalContext.currentYear}. Return ONLY valid JSON array, nothing else.`
    );
    const retryText = retryResult.response.text().trim();
    const retryCleaned = retryText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const retryParsed = JSON.parse(retryCleaned) as ContentPlanPost[];

    const normalized = retryParsed.map((p, i) => ({
      slotIndex: p.slotIndex ?? i,
      category: p.category || "educational",
      templateId: resolveTemplateForPlan(
        { category: p.category || "educational", templateId: p.templateId },
        slots[p.slotIndex ?? i]?.platformKey || "instagram_feed",
        calendarOptions
      ).id,
      postConcept: p.postConcept || `Brand content for ${slots[i]?.platform || "social media"}`,
      painPoint: p.painPoint || "specific audience pain from project intelligence",
      audienceMoment: p.audienceMoment || "target audience facing the problem this product solves",
      headline: p.headline || "Fix The Hidden Pain",
      subheadline: p.subheadline || p.painPoint || "Show the audience a concrete problem and the product mechanism that solves it",
      cta: p.cta || "",
      slideCopy: Array.isArray(p.slideCopy) && p.slideCopy.length > 0
        ? p.slideCopy
        : [
            ...genericFallbackSlideCopy({
              headline: p.headline,
              subheadline: p.subheadline,
              cta: p.cta,
              painPoint: p.painPoint,
            }),
          ],
    }));
    return sanitizeContentPlanTemporalReferences(normalized, temporalContext).plan;
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
