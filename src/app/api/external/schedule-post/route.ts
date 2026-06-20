import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { z } from "zod";

/**
 * External API endpoint for Hermes (or other automation) to schedule posts.
 * Authenticates with CRON_SECRET — no Supabase user session required.
 *
 * POST /api/external/schedule-post
 * Authorization: Bearer ${CRON_SECRET}
 *
 * Body:
 * {
 *   projectId: string (UUID),
 *   platforms: [
 *     {
 *       platform: "facebook" | "instagram" | "tiktok" | "linkedin" | "twitter",
 *       caption: string,
 *       hashtags?: string[],
 *       mediaUrls?: string[]
 *     }
 *   ],
 *   scheduledAt?: string (ISO datetime — if omitted, picks next optimal slot)
 *   locale?: "he" | "en" (default: "he")
 * }
 *
 * If platform is specified but no social_account exists for it, that platform is skipped
 * (not an error — returns which platforms were skipped).
 */

const OPTIMAL_TIMES: Record<string, Record<string, Array<[number, number]>>> = {
  he: {
    instagram: [[12, 14], [19, 22]],
    facebook: [[11, 13], [18, 21]],
    tiktok: [[18, 23]],
    twitter: [[12, 14], [19, 21]],
    linkedin: [[8, 10], [17, 18]],
  },
  en: {
    instagram: [[11, 13], [18, 20]],
    facebook: [[10, 12], [17, 19]],
    tiktok: [[17, 21]],
    twitter: [[8, 10], [12, 13]],
    linkedin: [[8, 10], [17, 18]],
  },
};

/**
 * Pick the next optimal posting time for a platform.
 * Returns an ISO datetime string.
 */
function pickNextOptimalTime(
  platforms: string[],
  locale: "he" | "en",
  fromDate: Date = new Date()
): string {
  const times = OPTIMAL_TIMES[locale] || OPTIMAL_TIMES.he;

  // Use the first platform's optimal times (or first platform in the list)
  const primaryPlatform = platforms.find((p) => times[p]) || platforms[0];
  const windows = times[primaryPlatform] || times.instagram;

  // Start from tomorrow to ensure we're in the future
  const candidate = new Date(fromDate);
  candidate.setDate(candidate.getDate() + 1);
  candidate.setHours(0, 0, 0, 0);

  // Try each window for the next 3 days
  for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
    const day = new Date(candidate);
    day.setDate(day.getDate() + dayOffset);

    for (const [startH, endH] of windows) {
      // Pick a random time within the window
      const hour = startH + Math.floor(Math.random() * (endH - startH));
      const minute = Math.floor(Math.random() * 50) + 5; // 5-55 to avoid round numbers
      day.setHours(hour, minute, 0, 0);

      if (day > new Date()) {
        return day.toISOString();
      }
    }
  }

  // Fallback: tomorrow at 10:00
  const fallback = new Date(candidate);
  fallback.setDate(fallback.getDate() + 1);
  fallback.setHours(10, 0, 0, 0);
  return fallback.toISOString();
}

const scheduleSchema = z.object({
  projectId: z.string().uuid(),
  platforms: z.array(
    z.object({
      platform: z.enum(["facebook", "instagram", "tiktok", "linkedin", "twitter"]),
      caption: z.string().min(1),
      hashtags: z.array(z.string()).default([]),
      mediaUrls: z.array(z.string()).default([]),
    })
  ).min(1),
  scheduledAt: z.string().datetime().optional(),
  locale: z.enum(["he", "en"]).default("he"),
});

export async function POST(request: Request) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = scheduleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { projectId, platforms, scheduledAt, locale } = parsed.data;
  const supabase = await createServiceRoleClient();

  // Get the project to find user_id
  const { data: project, error: projError } = await supabase
    .from("projects")
    .select("id, user_id, name")
    .eq("id", projectId)
    .single();

  if (projError || !project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  // Get connected social accounts for this project
  const { data: socialAccounts, error: saError } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "active");

  if (saError) {
    return NextResponse.json(
      { error: "Failed to fetch social accounts" },
      { status: 500 }
    );
  }

  // Match platforms to social accounts
  const scheduledPlatforms: Array<{
    socialAccountId: string;
    platform: string;
    caption: string;
    hashtags: string[];
    mediaUrls: string[];
  }> = [];
  const skippedPlatforms: Array<{ platform: string; reason: string }> = [];

  for (const p of platforms) {
    // Instagram uses Facebook's account token
    const lookupPlatform = p.platform === "instagram" ? "facebook" : p.platform;
    const account = socialAccounts?.find(
      (sa: { platform: string }) => sa.platform === lookupPlatform
    );

    if (!account) {
      skippedPlatforms.push({
        platform: p.platform,
        reason: "No connected social account for this platform",
      });
      continue;
    }

    scheduledPlatforms.push({
      socialAccountId: account.id,
      platform: p.platform,
      caption: p.caption,
      hashtags: p.hashtags,
      mediaUrls: p.mediaUrls,
    });
  }

  if (scheduledPlatforms.length === 0) {
    return NextResponse.json(
      {
        error: "No platforms could be scheduled",
        skipped: skippedPlatforms,
      },
      { status: 400 }
    );
  }

  // Determine scheduled time
  const finalScheduledAt =
    scheduledAt || pickNextOptimalTime(
      scheduledPlatforms.map((p) => p.platform),
      locale
    );

  // Create the post
  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      user_id: project.user_id,
      project_id: projectId,
      status: "scheduled",
      scheduled_at: finalScheduledAt,
    })
    .select()
    .single();

  if (postError || !post) {
    return NextResponse.json(
      { error: postError?.message || "Failed to create post" },
      { status: 500 }
    );
  }

  // Create platform targets
  const platformInserts = scheduledPlatforms.map((p) => ({
    post_id: post.id,
    social_account_id: p.socialAccountId,
    platform: p.platform,
    caption: p.caption,
    hashtags: p.hashtags,
    media_urls: p.mediaUrls,
  }));

  const { error: ppError } = await supabase
    .from("post_platforms")
    .insert(platformInserts);

  if (ppError) {
    // Cleanup
    await supabase.from("posts").delete().eq("id", post.id);
    return NextResponse.json(
      { error: ppError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      postId: post.id,
      scheduledAt: finalScheduledAt,
      platforms: scheduledPlatforms.map((p) => ({
        platform: p.platform,
        caption: p.caption.substring(0, 80) + "...",
        mediaCount: p.mediaUrls.length,
      })),
      skipped: skippedPlatforms,
    },
    { status: 201 }
  );
}
