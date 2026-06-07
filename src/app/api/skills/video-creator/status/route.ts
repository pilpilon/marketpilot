import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { VideoJobMetadata, VideoJobStatusResponse } from "@/lib/video/types";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  await advanceVideoJobFromStatusPoll(request);

  const { data: job, error } = await supabase
    .from("pipeline_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const meta = (job.metadata || {}) as VideoJobMetadata & {
    assetId?: string;
  };

  const response: VideoJobStatusResponse = {
    jobId: job.id,
    status: job.status,
    currentStep: job.current_step || "",
    totalScenes: job.total_posts || 0,
    completedScenes: job.completed_posts || 0,
    campaignId: job.campaign_id,
    assetId: meta.assetId,
    finalVideoUrl: meta.finalVideoUrl,
    errorMessage: job.error_message,
    warnings: meta.warnings || [],
    costUsd: meta.costUsd || 0,
  };

  return NextResponse.json(response);
}

async function advanceVideoJobFromStatusPoll(request: Request): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;

  try {
    const workerUrl = new URL("/api/cron/process-video-jobs", request.url);
    await fetch(workerUrl, {
      method: "GET",
      headers: { authorization: `Bearer ${secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    });
  } catch {
    // Best-effort: the status endpoint should still return the latest persisted state.
  }
}
