/**
 * Video composer — stitches Veo scenes + overlay cards + music into a
 * final MP4.
 *
 * Phase 1 ships with a provider-agnostic interface and two implementations:
 *
 *   1. RemotionLambdaComposer — production-grade, calls the Remotion Lambda
 *      renderer. Requires AWS setup and REMOTION_SERVE_URL + REMOTION_LAMBDA_*
 *      env vars. Reuses src/remotion/* components.
 *
 *   2. FallbackComposer — ships video out the door immediately by returning
 *      the first scene's URL as the "final" video. No stitching, no music,
 *      no overlay cards — but it's testable end-to-end without AWS.
 *
 * The orchestrator picks by env: if REMOTION_SERVE_URL is set, use Remotion.
 * Otherwise, fall back (and warn the user).
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
  /** Brand palette for overlay cards. */
  brandPalette: {
    primary: string;
    accent: string;
    text: string;
  };
}

export interface ComposeResult {
  /** Public URL of the final MP4. */
  videoUrl: string;
  /** Total duration in seconds. */
  durationSeconds: number;
  /** Implementation used. */
  composer: "remotion_lambda" | "fallback_first_scene";
  /** Any warnings (e.g. "used fallback composer"). */
  warnings: string[];
}

function isRemotionConfigured(): boolean {
  return Boolean(
    process.env.REMOTION_SERVE_URL &&
      process.env.REMOTION_AWS_REGION &&
      process.env.REMOTION_LAMBDA_FUNCTION_NAME
  );
}

export async function composeVideo(input: ComposeInput): Promise<ComposeResult> {
  if (isRemotionConfigured()) {
    return composeWithRemotionLambda(input);
  }
  return composeWithFallback(input);
}

/**
 * Remotion Lambda composer — renders src/remotion/VideoComposition.tsx
 * on AWS Lambda.
 *
 * Setup (one-time):
 *   1. npx remotion lambda policies user  (create IAM user, paste policy)
 *   2. npx remotion lambda functions deploy
 *   3. npx remotion lambda sites create src/remotion/index.ts --site-name=marketpilot-video
 *   4. Copy serve URL + function name into env:
 *        REMOTION_SERVE_URL=...
 *        REMOTION_LAMBDA_FUNCTION_NAME=...
 *        REMOTION_AWS_REGION=us-east-1
 *        REMOTION_AWS_ACCESS_KEY_ID=...
 *        REMOTION_AWS_SECRET_ACCESS_KEY=...
 *
 * The @remotion/lambda package is imported dynamically so the app builds
 * even when Remotion isn't installed yet.
 */
async function composeWithRemotionLambda(
  input: ComposeInput
): Promise<ComposeResult> {
  // Dynamic import so the app still builds without @remotion/lambda.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lambda = await (import("@remotion/lambda/client" as string) as Promise<any>).catch(
    () => null
  );
  if (!lambda) {
    return composeWithFallback({
      ...input,
    });
  }

  const { renderMediaOnLambda, getRenderProgress } = lambda as {
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
  };

  const serveUrl = process.env.REMOTION_SERVE_URL!;
  const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME!;
  const region = process.env.REMOTION_AWS_REGION || "us-east-1";

  const totalSeconds = input.scenes.reduce((sum, s) => sum + s.duration, 0);
  const fps = 30;

  // Fresh AWS accounts default to 10 concurrent Lambda executions and
  // very low Invoke API TPS. Using a large framesPerLambda value minimizes
  // fan-out. For 32s @ 30fps = 960 frames: framesPerLambda=480 → 2
  // renderer lambdas + 1 orchestrator = 3 total. Override with env var
  // VIDEO_FRAMES_PER_LAMBDA once quota is raised for faster renders.
  const framesPerLambda = parseInt(
    process.env.VIDEO_FRAMES_PER_LAMBDA || "480",
    10
  );
  const { renderId, bucketName } = await renderMediaOnLambda({
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

  // Poll until done
  const start = Date.now();
  const timeoutMs = 5 * 60 * 1000;
  while (Date.now() - start < timeoutMs) {
    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName,
      region,
    });
    if (progress.fatalErrorEncountered) {
      throw new Error(
        `Remotion render failed: ${progress.errors.map((e: { message: string }) => e.message).join("; ")}`
      );
    }
    if (progress.done && progress.outputFile) {
      return {
        videoUrl: progress.outputFile,
        durationSeconds: totalSeconds,
        composer: "remotion_lambda",
        warnings: [],
      };
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error("Remotion render timed out after 5 minutes");
}

/**
 * Fallback composer — returns the first scene's URL directly.
 *
 * This is only a stopgap so the pipeline ships end-to-end before the user
 * completes AWS setup. It surfaces a warning so the UI can tell the user
 * why their video is only 8 seconds with no overlays.
 */
async function composeWithFallback(input: ComposeInput): Promise<ComposeResult> {
  const firstScene = input.scenes[0];
  if (!firstScene?.videoUrl) {
    throw new Error("Fallback composer requires at least one scene with a videoUrl");
  }
  return {
    videoUrl: firstScene.videoUrl,
    durationSeconds: firstScene.duration,
    composer: "fallback_first_scene",
    warnings: [
      "Remotion Lambda not configured — video is the first scene only, " +
        "without overlay cards or music. Set REMOTION_SERVE_URL, " +
        "REMOTION_LAMBDA_FUNCTION_NAME, and REMOTION_AWS_REGION to enable " +
        "full stitching.",
    ],
  };
}
