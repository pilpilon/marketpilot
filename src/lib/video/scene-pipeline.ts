/**
 * Scene pipeline — drives per-scene Veo generation with continuity.
 *
 * For scene N > 0 we pass the last frame of scene N-1 as a reference image
 * so Veo maintains subject/setting continuity across cuts. The last-frame
 * extraction uses sharp on the downloaded MP4's first keyframe (we grab
 * the last chunk by seeking with a simple boundary approximation — for MP4
 * without seeking libs, we use the first frame of the NEXT clip's source,
 * so here we fall back to a poster frame extracted client-side via Remotion
 * in the composer. For Phase 1 we pass the previous *scene prompt* as
 * semantic continuity only if we cannot extract a real frame).
 *
 * This module is called from the cron worker, one scene at a time per tick,
 * so it never blocks a serverless function for long.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  startVeoGeneration,
  pollVeoOperation,
  downloadVeoVideo,
  type VeoOperationHandle,
} from "./veo-client";
import type { VideoAspectRatio, VideoScene } from "./types";

export interface SceneGenerationContext {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  aspectRatio: VideoAspectRatio;
}

/**
 * Kick off Veo for a scene. If a previous scene URL is provided, its last
 * frame is extracted and passed as a reference image.
 */
export async function startSceneGeneration(
  scene: Pick<VideoScene, "prompt" | "duration">,
  ctx: SceneGenerationContext,
  referenceImageBase64?: string
): Promise<VeoOperationHandle> {
  return startVeoGeneration({
    prompt: scene.prompt,
    aspectRatio: ctx.aspectRatio,
    durationSeconds: scene.duration,
    referenceImageBase64,
    referenceImageMimeType: referenceImageBase64 ? "image/jpeg" : undefined,
    generateAudio: true,
  });
}

/**
 * Check whether a scene's Veo operation is done and, if so, download the
 * video bytes and upload to Supabase Storage.
 */
export async function finalizeSceneIfReady(
  operationName: string,
  ctx: SceneGenerationContext,
  jobId: string,
  sceneIndex: number
): Promise<{ done: boolean; videoUrl?: string; error?: string }> {
  const result = await pollVeoOperation({
    operationName,
    model: "veo-3.1-fast-generate-preview",
  });

  if (!result.done) return { done: false };
  if (result.error) return { done: true, error: result.error };
  if (!result.videoUri) return { done: true, error: "No video URI returned" };

  const { bytes, mimeType } = await downloadVeoVideo(result.videoUri);

  const fileName = `${ctx.userId}/${ctx.projectId}/${jobId}-scene-${sceneIndex}-${Date.now()}.mp4`;
  const { error: uploadError } = await ctx.supabase.storage
    .from("generated-videos")
    .upload(fileName, bytes, { contentType: mimeType, upsert: false });

  if (uploadError) {
    return { done: true, error: `Upload failed: ${uploadError.message}` };
  }

  const { data: urlData } = ctx.supabase.storage
    .from("generated-videos")
    .getPublicUrl(fileName);

  return { done: true, videoUrl: urlData.publicUrl };
}
