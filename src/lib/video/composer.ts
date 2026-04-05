/**
 * Video composer — stitches Veo scenes + overlay cards + music into a
 * final MP4.
 *
 * Exposes an async API so the worker can kick off a render and poll
 * across multiple cron ticks without blocking a Vercel function:
 *
 *   startComposition(input)  → { composer, handle?, immediate? }
 *   pollComposition(handle)  → { done, videoUrl?, error? }
 *
 * Two composers:
 *   1. remotion_lambda — calls the Remotion Lambda renderer on AWS.
 *   2. fallback_first_scene — returns the first scene URL as-is (no
 *      stitching), used when Remotion env vars aren't set.
 */

import type { VideoAspectRatio, VideoLanguage, VideoScene } from "./types";

export interface ComposeInput {
  scenes: Array<Pick<VideoScene, "videoUrl" | "overlayText" | "duration">>;
  hook: string;
  keyMessage: string;
  cta: string;
  language: VideoLanguage;
  aspectRatio: VideoAspectRatio;
  musicTrackUrl: string | null;
  brandPalette: {
    primary: string;
    accent: string;
    text: string;
  };
}

export type ComposerName = "remotion_lambda" | "fallback_first_scene";

export interface ComposerHandle {
  composer: ComposerName;
  /** renderId returned by renderMediaOnLambda. */
  renderId: string;
  /** bucketName returned by renderMediaOnLambda. */
  bucketName: string;
  /** functionName used for this render (persist to avoid env drift). */
  functionName: string;
  /** AWS region for this render. */
  region: string;
  /** Total duration in seconds (persisted for asset metadata). */
  durationSeconds: number;
}

export interface StartCompositionResult {
  composer: ComposerName;
  /** Set when the composer is async (Remotion Lambda). */
  handle?: ComposerHandle;
  /** Set when the composer finishes immediately (fallback). */
  immediate?: {
    videoUrl: string;
    durationSeconds: number;
    warnings: string[];
  };
}

export interface PollCompositionResult {
  done: boolean;
  videoUrl?: string;
  durationSeconds?: number;
  error?: string;
}

function isRemotionConfigured(): boolean {
  return Boolean(
    process.env.REMOTION_SERVE_URL &&
      process.env.REMOTION_AWS_REGION &&
      process.env.REMOTION_LAMBDA_FUNCTION_NAME
  );
}

/**
 * Kick off composition. Returns immediately with a handle to poll later
 * (Remotion) or an immediate result (fallback).
 */
export async function startComposition(
  input: ComposeInput
): Promise<StartCompositionResult> {
  if (isRemotionConfigured()) {
    return startRemotionLambda(input);
  }
  return startFallback(input);
}

/**
 * Poll a composition handle. Returns done=false if still rendering.
 */
export async function pollComposition(
  handle: ComposerHandle
): Promise<PollCompositionResult> {
  if (handle.composer === "remotion_lambda") {
    return pollRemotionLambda(handle);
  }
  // fallback is instant-only; pollComposition should never be called for it.
  return {
    done: true,
    error: "pollComposition called with fallback handle (should never happen)",
  };
}

// ── Remotion Lambda ─────────────────────────────────────────────────────────

interface LambdaClient {
  renderMediaOnLambda: (opts: Record<string, unknown>) => Promise<{
    renderId: string;
    bucketName: string;
  }>;
  getRenderProgress: (opts: Record<string, unknown>) => Promise<{
    done: boolean;
    outputFile?: string | null;
    fatalErrorEncountered?: boolean;
    errors: Array<{ message: string }>;
  }>;
}

async function loadLambdaClient(): Promise<LambdaClient | null> {
  try {
    const mod = (await import(
      "@remotion/lambda/client" as string
    )) as LambdaClient;
    return mod;
  } catch {
    return null;
  }
}

async function startRemotionLambda(
  input: ComposeInput
): Promise<StartCompositionResult> {
  const lambda = await loadLambdaClient();
  if (!lambda) {
    return startFallback(input);
  }

  const serveUrl = process.env.REMOTION_SERVE_URL;
  const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
  const region = process.env.REMOTION_AWS_REGION || "us-east-1";

  if (!serveUrl || !functionName) {
    return startFallback(input);
  }

  const totalSeconds = input.scenes.reduce((sum, s) => sum + s.duration, 0);
  const fps = 30;

  // framesPerLambda controls render fan-out. Lower = more parallel lambdas,
  // faster per-chunk render. 120 → 8 renderers for 960 frames (32s@30fps).
  // Override via VIDEO_FRAMES_PER_LAMBDA.
  const framesPerLambda = parseInt(
    process.env.VIDEO_FRAMES_PER_LAMBDA || "120",
    10
  );

  const { renderId, bucketName } = await lambda.renderMediaOnLambda({
    region,
    functionName,
    serveUrl,
    composition: "MarketPilotVideo",
    codec: "h264",
    imageFormat: "jpeg",
    maxRetries: 1,
    privacy: "public",
    framesPerLambda,
    concurrencyPerLambda: 1,
    inputProps: {
      scenes: input.scenes,
      hook: input.hook,
      keyMessage: input.keyMessage,
      cta: input.cta,
      language: input.language,
      aspectRatio: input.aspectRatio,
      musicTrackUrl: input.musicTrackUrl,
      brandPalette: input.brandPalette,
      totalDurationInFrames: totalSeconds * fps,
      fps,
    },
  });

  return {
    composer: "remotion_lambda",
    handle: {
      composer: "remotion_lambda",
      renderId,
      bucketName,
      functionName,
      region,
      durationSeconds: totalSeconds,
    },
  };
}

async function pollRemotionLambda(
  handle: ComposerHandle
): Promise<PollCompositionResult> {
  const lambda = await loadLambdaClient();
  if (!lambda) {
    return { done: true, error: "@remotion/lambda/client not installed" };
  }

  const progress = await lambda.getRenderProgress({
    renderId: handle.renderId,
    bucketName: handle.bucketName,
    functionName: handle.functionName,
    region: handle.region,
  });

  if (progress.fatalErrorEncountered) {
    const msg = progress.errors
      .map((e: { message: string }) => e.message)
      .join("; ");
    return { done: true, error: `Remotion render failed: ${msg}` };
  }

  if (progress.done && progress.outputFile) {
    return {
      done: true,
      videoUrl: progress.outputFile,
      durationSeconds: handle.durationSeconds,
    };
  }

  return { done: false };
}

// ── Fallback (instant) ──────────────────────────────────────────────────────

function startFallback(input: ComposeInput): StartCompositionResult {
  const firstScene = input.scenes[0];
  if (!firstScene?.videoUrl) {
    throw new Error(
      "Fallback composer requires at least one scene with a videoUrl"
    );
  }
  return {
    composer: "fallback_first_scene",
    immediate: {
      videoUrl: firstScene.videoUrl,
      durationSeconds: firstScene.duration,
      warnings: [
        "Remotion Lambda not configured — video is the first scene only, " +
          "without overlay cards or music. Set REMOTION_SERVE_URL, " +
          "REMOTION_LAMBDA_FUNCTION_NAME, and REMOTION_AWS_REGION to enable " +
          "full stitching.",
      ],
    },
  };
}
