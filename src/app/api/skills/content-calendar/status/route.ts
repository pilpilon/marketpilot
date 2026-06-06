import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  const { data: job, error } = await supabase
    .from("pipeline_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const metadata = (job.metadata as Record<string, unknown>) || {};

  return NextResponse.json({
    status: job.status,
    totalPosts: job.total_posts,
    completedPosts: job.completed_posts,
    currentStep: job.current_step,
    campaignId: job.campaign_id,
    error: job.error_message,
    warnings: metadata.warnings || [],
    strategyPreview: metadata.strategyPreview || null,
    qualityGate: metadata.qualityGate || null,
  });
}
