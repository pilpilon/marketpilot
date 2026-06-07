import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseProjectSettings, buildLocaleContext } from "@/lib/ai/locale-context";
import { estimateVideoCost, assertBelowCap } from "@/lib/video/cost-guard";
import { encryptSecret } from "@/lib/security/credentials";
import type {
  CreateVideoJobInput,
  VideoJobMetadata,
  VideoFramework,
  VideoLanguage,
  VideoMode,
  MusicMood,
  VideoTemplate,
} from "@/lib/video/types";

const DEFAULT_DURATION = 16;
const SCENE_DURATION = 8;

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as CreateVideoJobInput;
  const {
    projectId,
    mode,
    language,
    durationSeconds,
    framework,
    template,
    goal,
    tone,
    musicMood,
    campaignName,
    productDemoAccess,
  } = body;

  if (!projectId || !mode) {
    return NextResponse.json(
      { error: "projectId and mode are required" },
      { status: 400 }
    );
  }

  // Verify project ownership
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, settings")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const settings = parseProjectSettings(project.settings);
  const resolvedLanguage: VideoLanguage =
    language ?? ((settings.locale === "he" ? "he" : "en") as VideoLanguage);

  const resolvedDuration = Math.max(
    16,
    Math.min(32, durationSeconds || DEFAULT_DURATION)
  );
  const sceneCount = Math.max(
    2,
    Math.min(6, Math.round(resolvedDuration / SCENE_DURATION))
  );

  // Pre-flight cost guard
  const estimate = estimateVideoCost({
    sceneCount,
    sceneDurationSeconds: SCENE_DURATION,
  });
  try {
    assertBelowCap(estimate);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Cost cap exceeded";
    return NextResponse.json({ error: msg, estimate }, { status: 400 });
  }

  // Create campaign
  const name =
    campaignName ||
    `Video Ad — ${new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`;

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      project_id: projectId,
      user_id: user.id,
      name,
      campaign_type: "video_ad",
      platforms: [],
      status: "draft",
      goal: goal || null,
    })
    .select()
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json(
      { error: campaignError?.message || "Failed to create campaign" },
      { status: 500 }
    );
  }

  const campaignId = (campaign as { id: string }).id;

  const safeProductDemoAccess = productDemoAccess?.demoUrl
    ? {
        demoUrl: productDemoAccess.demoUrl,
        demoEmail: productDemoAccess.demoEmail || undefined,
        encryptedPassword: productDemoAccess.demoPassword
          ? encryptSecret(productDemoAccess.demoPassword)
          : undefined,
        password: productDemoAccess.demoPassword ? "[redacted]" as const : undefined,
      }
    : undefined;

  // Create pipeline job with video-creator metadata
  const jobMetadata: VideoJobMetadata = {
    mode: mode as VideoMode,
    language: resolvedLanguage,
    durationSeconds: resolvedDuration,
    aspectRatio: "9:16",
    framework: (framework || "problem_aha_proof_cta") as VideoFramework,
    template: (template || "product_demo") as VideoTemplate,
    musicMood: (musicMood || "upbeat") as MusicMood,
    costUsd: 0,
    warnings: [],
    productDemoAccess: safeProductDemoAccess,
  };

  // Stash goal/tone/localeContext into metadata for the worker
  const localeCtx = buildLocaleContext(settings);
  const extendedMeta = {
    ...jobMetadata,
    goal: goal || null,
    tone: tone || null,
    localeContext: localeCtx.skillContext || null,
    sceneCount,
  };

  const { data: job, error: jobError } = await supabase
    .from("pipeline_jobs")
    .insert({
      project_id: projectId,
      user_id: user.id,
      campaign_id: campaignId,
      job_type: "video_creator",
      status: "pending",
      current_step: "Queued…",
      total_posts: sceneCount,
      completed_posts: 0,
      metadata: extendedMeta,
    })
    .select()
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: jobError?.message || "Failed to create job" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    jobId: (job as { id: string }).id,
    campaignId,
    estimate,
  });
}
