import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadBrandContext, loadBrandTokens } from "@/lib/templates/brand-tokens";
import { generateVideoScript } from "@/lib/video/script-generator";
import {
  startSceneGeneration,
  finalizeSceneIfReady,
} from "@/lib/video/scene-pipeline";
import {
  startComposition,
  pollComposition,
  type ComposerHandle,
} from "@/lib/video/composer";
import { getMusicTrackUrl } from "@/lib/video/music-library";
import { estimateVideoCost } from "@/lib/video/cost-guard";
import type {
  VideoJobMetadata,
  VideoScript,
  VideoFramework,
  VideoTemplate,
  VideoLanguage,
  MusicMood,
} from "@/lib/video/types";

export const maxDuration = 60;

/**
 * State machine transitions:
 *   pending    → planning   (script generation starts)
 *   planning   → generating (script done, scene ops kicked off)
 *   generating → generating (polling scenes, one at a time)
 *   generating → composing  (all scenes uploaded, composer running)
 *   composing  → completed  (final MP4 saved, asset record created)
 *   *          → failed     (any error, error_message set)
 *
 * Each tick advances at most ONE scene or ONE compose step so we never
 * exceed the 60s serverless timeout.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceRoleClient();

  // Pull up to 3 active jobs (FIFO)
  const { data: jobs, error } = await supabase
    .from("pipeline_jobs")
    .select("*")
    .eq("job_type", "video_creator")
    .in("status", ["pending", "planning", "generating", "composing"])
    .order("updated_at", { ascending: true })
    .limit(3);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  const results: Array<{ jobId: string; status: string; error?: string }> = [];

  for (const job of jobs) {
    try {
      const nextStatus = await advanceJob(supabase, job);
      results.push({ jobId: job.id, status: nextStatus });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await markFailed(supabase, job.id, msg);
      results.push({ jobId: job.id, status: "failed", error: msg });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

type JobRow = {
  id: string;
  project_id: string;
  user_id: string;
  campaign_id: string;
  status: string;
  current_step: string | null;
  total_posts: number;
  completed_posts: number;
  metadata: JobMetadata | null;
};

type JobMetadata = VideoJobMetadata & {
  goal?: string | null;
  tone?: string | null;
  localeContext?: string | null;
  sceneCount?: number;
  assetId?: string;
  sceneOperations?: Array<{
    index: number;
    operationName: string;
    done: boolean;
  }>;
  composerHandle?: ComposerHandle;
  [key: string]: unknown;
};

async function advanceJob(
  supabase: SupabaseClient,
  job: JobRow
): Promise<string> {
  const meta = (job.metadata || {}) as JobMetadata;

  if (job.status === "pending") {
    return await stagePlanning(supabase, job, meta);
  }

  if (job.status === "planning") {
    const hasStartedScenes = Boolean(
      meta?.script &&
        Array.isArray(meta?.sceneOperations) &&
        meta.sceneOperations.length > 0
    );

    if (!hasStartedScenes) {
      return "planning";
    }

    return await stageScenes(supabase, job, meta);
  }

  if (job.status === "generating") {
    return await stageScenes(supabase, job, meta);
  }

  if (job.status === "composing") {
    return await stageCompose(supabase, job, meta);
  }

  return job.status;
}

// ── Stage: Planning ────────────────────────────────────────────────────────
async function stagePlanning(
  supabase: SupabaseClient,
  job: JobRow,
  meta: JobMetadata
): Promise<string> {
  await updateJob(supabase, job.id, {
    status: "planning",
    current_step: "Writing script from brand intelligence…",
  });

  const brandContext = await loadBrandContext(supabase, job.project_id);

  const script: VideoScript = await generateVideoScript({
    brandContext,
    framework: (meta?.framework || "problem_aha_proof_cta") as VideoFramework,
    language: (meta?.language || "en") as VideoLanguage,
    durationSeconds: meta?.durationSeconds || 30,
    goal: (meta?.goal as string | undefined) || undefined,
    tone: (meta?.tone as string | undefined) || undefined,
    localeContext:
      (meta?.localeContext as string | undefined) || undefined,
    features: brandContext.features || undefined,
    template: (meta?.template || "product_demo") as VideoTemplate,
  });

  // Respect user's chosen mood if it wasn't "auto"
  const chosenMood = (meta?.musicMood as MusicMood) || script.musicMood;
  const musicTrackUrl = getMusicTrackUrl(chosenMood);

  // Load approved screenshot for scenes that mention the app/product
  let projectScreenshotBase64: string | undefined;
  try {
    const { data: screenshots } = await supabase
      .from("project_screenshots")
      .select("public_url, viewport")
      .eq("project_id", job.project_id)
      .eq("approved", true)
      .order("viewport", { ascending: true })
      .limit(1);

    if (screenshots?.length) {
      const res = await fetch((screenshots[0] as { public_url: string }).public_url, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        projectScreenshotBase64 = Buffer.from(await res.arrayBuffer()).toString("base64");
      }
    }
  } catch {
    // Best-effort
  }

  // Detect if scene prompt references the app/product
  const sceneReferencesApp = (prompt: string) =>
    /\b(app|screen|interface|dashboard|website|platform|homepage|landing)\b/i.test(prompt);

  const firstSceneRef = sceneReferencesApp(script.scenes[0].prompt)
    ? projectScreenshotBase64
    : undefined;

  // Kick off scene 0
  const firstHandle = await startSceneGeneration(
    script.scenes[0],
    {
      supabase,
      userId: job.user_id,
      projectId: job.project_id,
      aspectRatio: "9:16",
    },
    firstSceneRef
  );

  const sceneOperations = [
    {
      index: 0,
      operationName: firstHandle.operationName,
      done: false,
    },
  ];

  await updateJob(supabase, job.id, {
    status: "generating",
    current_step: `Generating scene 1 of ${script.scenes.length}…`,
    total_posts: script.scenes.length,
    completed_posts: 0,
    metadata: {
      ...meta,
      musicTrackUrl: musicTrackUrl || undefined,
      musicMood: chosenMood,
      script,
      sceneOperations,
    },
  });

  return "generating";
}

// ── Stage: Scene generation ────────────────────────────────────────────────
async function stageScenes(
  supabase: SupabaseClient,
  job: JobRow,
  meta: JobMetadata
): Promise<string> {
  const script = meta?.script as VideoScript | undefined;
  const sceneOps = (meta?.sceneOperations || []) as Array<{
    index: number;
    operationName: string;
    done: boolean;
  }>;

  if (!script || sceneOps.length === 0) {
    throw new Error("Job in generating state but missing script/operations");
  }

  // Find the first active (not done) scene and poll it
  const active = sceneOps.find((op) => !op.done);
  if (!active) {
    // All done — transition to composing
    return await transitionToCompose(supabase, job, meta, script);
  }

  const finalize = await finalizeSceneIfReady(
    active.operationName,
    {
      supabase,
      userId: job.user_id,
      projectId: job.project_id,
      aspectRatio: "9:16",
    },
    job.id,
    active.index
  );

  if (!finalize.done) {
    // Still polling — update step text only
    await updateJob(supabase, job.id, {
      current_step: `Generating scene ${active.index + 1} of ${script.scenes.length}…`,
    });
    return "generating";
  }

  if (finalize.error) throw new Error(`Scene ${active.index}: ${finalize.error}`);
  if (!finalize.videoUrl) throw new Error(`Scene ${active.index}: no video URL`);

  // Mark this scene done, update its URL in the script
  const updatedScript: VideoScript = {
    ...script,
    scenes: script.scenes.map((s, i) =>
      i === active.index ? { ...s, videoUrl: finalize.videoUrl } : s
    ),
  };
  const updatedOps = sceneOps.map((op) =>
    op.index === active.index ? { ...op, done: true } : op
  );

  // Track cost as scenes complete
  const estimate = estimateVideoCost({
    sceneCount: script.scenes.length,
    sceneDurationSeconds: script.scenes[0]?.duration || 8,
  });
  const perScene = estimate.veoCost / script.scenes.length;
  const costUsd = (meta.costUsd || 0) + perScene;

  // Start the NEXT scene if there is one
  const nextIndex = active.index + 1;
  if (nextIndex < updatedScript.scenes.length) {
    const prevVideoUrl = updatedScript.scenes[active.index].videoUrl;
    const referenceImageBase64 = prevVideoUrl
      ? await extractPosterFrame(prevVideoUrl).catch(() => undefined)
      : undefined;

    const nextHandle = await startSceneGeneration(
      updatedScript.scenes[nextIndex],
      {
        supabase,
        userId: job.user_id,
        projectId: job.project_id,
        aspectRatio: "9:16",
      },
      referenceImageBase64
    );
    updatedOps.push({
      index: nextIndex,
      operationName: nextHandle.operationName,
      done: false,
    });
  }

  const completedCount = updatedOps.filter((op) => op.done).length;

  await updateJob(supabase, job.id, {
    completed_posts: completedCount,
    current_step:
      nextIndex < updatedScript.scenes.length
        ? `Generating scene ${nextIndex + 1} of ${updatedScript.scenes.length}…`
        : `Finishing scene ${completedCount} of ${updatedScript.scenes.length}…`,
    metadata: {
      ...meta,
      script: updatedScript,
      sceneOperations: updatedOps,
      costUsd,
    },
  });

  // If every scene is done, move to composing on this tick
  if (completedCount === updatedScript.scenes.length) {
    return await transitionToCompose(
      supabase,
      { ...job, metadata: { ...meta, script: updatedScript } },
      { ...meta, script: updatedScript, costUsd },
      updatedScript
    );
  }

  return "generating";
}

// ── Stage: Compose ─────────────────────────────────────────────────────────
async function transitionToCompose(
  supabase: SupabaseClient,
  job: JobRow,
  meta: JobMetadata,
  script: VideoScript
): Promise<string> {
  await updateJob(supabase, job.id, {
    status: "composing",
    current_step: "Stitching scenes + overlays + music…",
    metadata: { ...meta, script },
  });
  return "composing";
}

async function stageCompose(
  supabase: SupabaseClient,
  job: JobRow,
  meta: JobMetadata
): Promise<string> {
  const script = meta?.script as VideoScript | undefined;
  if (!script) throw new Error("No script in metadata for composing stage");

  // All scenes should have videoUrl by now
  if (script.scenes.some((s) => !s.videoUrl)) {
    throw new Error("Some scenes are missing video URLs at compose time");
  }

  // ── If a composer handle is already persisted, poll it ──
  const existingHandle = meta.composerHandle;
  if (existingHandle) {
    const pollResult = await pollComposition(existingHandle);
    if (!pollResult.done) {
      // Still rendering — just refresh the step text
      await updateJob(supabase, job.id, {
        current_step: "Stitching scenes + overlays + music…",
      });
      return "composing";
    }
    if (pollResult.error) {
      throw new Error(pollResult.error);
    }
    if (!pollResult.videoUrl) {
      throw new Error("Composer finished but returned no video URL");
    }
    // Render complete → save asset, mark job complete
    return await finalizeComposition(
      supabase,
      job,
      meta,
      script,
      pollResult.videoUrl,
      pollResult.durationSeconds ?? existingHandle.durationSeconds,
      existingHandle.composer,
      []
    );
  }

  // ── First time in composing stage: kick off the render ──
  const brandTokens = await loadBrandTokens(supabase, job.project_id);

  // Probe the music track — if it 404s, drop it so Remotion doesn't
  // crash on a missing asset.
  const rawMusicUrl = (meta?.musicTrackUrl as string | undefined) || null;
  let musicTrackUrl: string | null = null;
  if (rawMusicUrl) {
    try {
      const probe = await fetch(rawMusicUrl, { method: "HEAD" });
      if (probe.ok) {
        musicTrackUrl = rawMusicUrl;
      }
    } catch {
      // leave as null
    }
  }
  const musicDroppedWarning =
    rawMusicUrl && !musicTrackUrl
      ? [
          "Background music track not found in storage — rendered without music. Upload MP3s to the music-library bucket.",
        ]
      : [];

  const startResult = await startComposition({
    scenes: script.scenes.map((s) => ({
      videoUrl: s.videoUrl,
      overlayText: s.overlayText,
      duration: s.duration,
    })),
    hook: script.hook,
    keyMessage: script.keyMessage,
    cta: script.cta,
    language: script.language,
    aspectRatio: "9:16",
    musicTrackUrl,
    brandPalette: {
      primary: brandTokens.primaryColor,
      accent: brandTokens.accentColor,
      text: brandTokens.textColor,
    },
  });

  // Fallback composer is instant — skip polling, go straight to finalize
  if (startResult.immediate) {
    return await finalizeComposition(
      supabase,
      job,
      meta,
      script,
      startResult.immediate.videoUrl,
      startResult.immediate.durationSeconds,
      startResult.composer,
      [...startResult.immediate.warnings, ...musicDroppedWarning]
    );
  }

  // Remotion: persist the handle, next tick will poll
  if (!startResult.handle) {
    throw new Error("Composer did not return a handle or immediate result");
  }

  const pendingWarnings = [...(meta.warnings || []), ...musicDroppedWarning];
  await updateJob(supabase, job.id, {
    current_step: "Stitching scenes + overlays + music…",
    metadata: {
      ...meta,
      composerHandle: startResult.handle,
      warnings: pendingWarnings,
    },
  });
  return "composing";
}

async function finalizeComposition(
  supabase: SupabaseClient,
  job: JobRow,
  meta: JobMetadata,
  script: VideoScript,
  videoUrl: string,
  durationSeconds: number,
  composer: string,
  extraWarnings: string[]
): Promise<string> {
  const { data: asset, error: assetError } = await supabase
    .from("campaign_assets")
    .insert({
      campaign_id: job.campaign_id,
      user_id: job.user_id,
      asset_type: "video",
      title: `Video — ${script.hook}`.slice(0, 120),
      content: `${script.hook}\n\n${script.keyMessage}\n\n${script.cta}`,
      storage_path: videoUrl,
      metadata: {
        duration_seconds: durationSeconds,
        aspect_ratio: "9:16",
        language: script.language,
        framework: script.framework,
        music_mood: script.musicMood,
        composer,
        captions: "burned_in_overlay_text",
        overlay_text_source: "script_generator",
        video_provider: "google",
        video_model: "veo-3.1-fast-generate-preview",
        scene_count: script.scenes.length,
        cost_usd: meta.costUsd || 0,
      },
      status: "draft",
    })
    .select()
    .single();

  if (assetError || !asset) {
    throw new Error(`Asset creation failed: ${assetError?.message}`);
  }

  const assetId = (asset as { id: string }).id;
  const warnings = [...(meta.warnings || []), ...extraWarnings];

  await updateJob(supabase, job.id, {
    status: "completed",
    current_step: "Complete",
    completed_posts: script.scenes.length,
    metadata: {
      ...meta,
      finalVideoUrl: videoUrl,
      composer,
      warnings,
      assetId,
    },
  });

  // Activate campaign
  await supabase
    .from("campaigns")
    .update({ status: "active" })
    .eq("id", job.campaign_id);

  return "completed";
}

// ── Helpers ────────────────────────────────────────────────────────────────
async function updateJob(
  supabase: SupabaseClient,
  jobId: string,
  updates: Record<string, unknown>
): Promise<void> {
  await supabase
    .from("pipeline_jobs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

async function markFailed(
  supabase: SupabaseClient,
  jobId: string,
  message: string
): Promise<void> {
  await supabase
    .from("pipeline_jobs")
    .update({
      status: "failed",
      error_message: message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

/**
 * Extract a reference frame from an MP4 URL for Veo scene continuity.
 *
 * Phase 1 stub: we return undefined (no reference). Proper extraction
 * requires ffmpeg or a frame-extraction service. The continuity then
 * relies on prompt-level consistency from the script generator.
 *
 * TODO (Phase 2): integrate a frame-extraction helper using sharp+ffmpeg
 * or a Supabase Edge Function that returns the last frame as base64.
 */
async function extractPosterFrame(videoUrl: string): Promise<string | undefined> {
  void videoUrl;
  return undefined;
}
