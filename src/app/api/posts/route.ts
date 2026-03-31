import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

const createPostSchema = z.object({
  projectId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  campaignAssetId: z.string().uuid().optional(),
  status: z.enum(["draft", "scheduled"]).default("draft"),
  scheduledAt: z.string().datetime().optional(),
  platforms: z.array(
    z.object({
      socialAccountId: z.string().uuid(),
      platform: z.enum(["twitter", "instagram", "tiktok"]),
      caption: z.string().optional(),
      hashtags: z.array(z.string()).default([]),
      mediaUrls: z.array(z.string()).default([]),
    })
  ),
});

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status");

  let query = supabase
    .from("posts")
    .select("*, post_platforms(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createPostSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { projectId, campaignId, campaignAssetId, status, scheduledAt, platforms } =
    parsed.data;

  if (status === "scheduled" && !scheduledAt) {
    return NextResponse.json(
      { error: "scheduledAt is required for scheduled posts" },
      { status: 400 }
    );
  }

  // Create the post
  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      project_id: projectId,
      campaign_id: campaignId || null,
      campaign_asset_id: campaignAssetId || null,
      status,
      scheduled_at: scheduledAt || null,
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
  const platformInserts = platforms.map((p) => ({
    post_id: post.id,
    social_account_id: p.socialAccountId,
    platform: p.platform,
    caption: p.caption || null,
    hashtags: p.hashtags,
    media_urls: p.mediaUrls,
  }));

  const { error: ppError } = await supabase
    .from("post_platforms")
    .insert(platformInserts);

  if (ppError) {
    // Cleanup: delete the post if platform targets failed
    await supabase.from("posts").delete().eq("id", post.id);
    return NextResponse.json(
      { error: ppError.message },
      { status: 500 }
    );
  }

  // Return the created post with platforms
  const { data: fullPost } = await supabase
    .from("posts")
    .select("*, post_platforms(*)")
    .eq("id", post.id)
    .single();

  return NextResponse.json(fullPost, { status: 201 });
}
