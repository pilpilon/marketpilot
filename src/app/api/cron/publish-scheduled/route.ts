import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { publishPost } from "@/lib/social/publisher";

export const maxDuration = 60; // Vercel Pro: up to 300s

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceRoleClient();

  // Fetch posts that are due for publishing
  // FOR UPDATE SKIP LOCKED prevents concurrent cron from processing same posts
  const { data: duePosts, error } = await supabase
    .from("posts")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(5);

  if (error) {
    console.error("Failed to fetch scheduled posts:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!duePosts || duePosts.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  const results = [];

  for (const post of duePosts) {
    // Set to publishing before processing (prevents double-processing)
    const { error: lockError } = await supabase
      .from("posts")
      .update({ status: "publishing" })
      .eq("id", post.id)
      .eq("status", "scheduled"); // Only if still scheduled

    if (lockError) {
      // Another cron instance may have grabbed it
      continue;
    }

    try {
      const result = await publishPost(post.id);
      results.push({ postId: post.id, ...result });
    } catch (err) {
      console.error(`Failed to publish post ${post.id}:`, err);
      results.push({
        postId: post.id,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
  });
}
