import { createServiceRoleClient } from "@/lib/supabase/server";
import { getPlatformClient } from "./platforms";
import { getAccountTokens } from "./token-manager";
import type { Database } from "@/types/database";

type Post = Database["public"]["Tables"]["posts"]["Row"];
type PostPlatform = Database["public"]["Tables"]["post_platforms"]["Row"];
type SocialAccount = Database["public"]["Tables"]["social_accounts"]["Row"];

interface PublishContext {
  post: Post;
  postPlatform: PostPlatform;
  socialAccount: SocialAccount;
}

/**
 * Publish a single post to a single platform.
 */
async function publishToPlatform(ctx: PublishContext): Promise<void> {
  const supabase = await createServiceRoleClient();
  const { postPlatform, socialAccount } = ctx;

  try {
    // Update status to publishing
    await supabase
      .from("post_platforms")
      .update({ status: "publishing" })
      .eq("id", postPlatform.id);

    // Get decrypted tokens
    const { accessToken } = await getAccountTokens(socialAccount);
    if (!accessToken) {
      throw new Error("No access token available. Account may need reconnection.");
    }

    const client = getPlatformClient(socialAccount.platform);
    const caption = postPlatform.caption || "";
    const hashtags = postPlatform.hashtags || [];
    const fullText = hashtags.length > 0
      ? `${caption}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`
      : caption;

    // For Facebook, pass project name so the publisher can match the correct Page
    let publishHint = socialAccount.platform_user_id || undefined;
    if (socialAccount.platform === "facebook" && ctx.post.project_id) {
      const { data: proj } = await supabase
        .from("projects")
        .select("name")
        .eq("id", ctx.post.project_id)
        .single();
      if (proj?.name) publishHint = proj.name;
    }

    console.log(`[publisher] publishing to ${socialAccount.platform}, media_urls=${JSON.stringify(postPlatform.media_urls)}, caption_length=${fullText.length}`);

    let result;
    if (postPlatform.media_urls && postPlatform.media_urls.length > 0) {
      result = await client.publishMedia(
        accessToken,
        fullText,
        postPlatform.media_urls,
        publishHint
      );
    } else {
      result = await client.publishText(accessToken, fullText);
    }
    console.log(`[publisher] result:`, JSON.stringify(result));

    // Update with success
    await supabase
      .from("post_platforms")
      .update({
        status: "published",
        platform_post_id: result.platformPostId,
        platform_post_url: result.platformPostUrl,
        published_at: new Date().toISOString(),
      })
      .eq("id", postPlatform.id);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown publishing error";

    await supabase
      .from("post_platforms")
      .update({
        status: "failed",
        error_message: errorMessage,
      })
      .eq("id", postPlatform.id);

    throw error;
  }
}

/**
 * Publish a post to all its target platforms.
 */
export async function publishPost(postId: string): Promise<{
  success: boolean;
  results: Array<{ platform: string; success: boolean; error?: string }>;
}> {
  const supabase = await createServiceRoleClient();

  // Update post status to publishing
  await supabase
    .from("posts")
    .update({ status: "publishing" })
    .eq("id", postId);

  // Get all platform targets for this post
  const { data: postPlatforms, error: ppError } = await supabase
    .from("post_platforms")
    .select("*, social_accounts(*)")
    .eq("post_id", postId)
    .in("status", ["pending", "failed"]);

  if (ppError || !postPlatforms || postPlatforms.length === 0) {
    console.log(`[publisher] no post_platforms found for post ${postId}, error: ${ppError?.message || "none"}, count: ${postPlatforms?.length ?? "null"}`);
    await supabase
      .from("posts")
      .update({ status: "failed" })
      .eq("id", postId);

    return { success: false, results: [] };
  }
  console.log(`[publisher] found ${postPlatforms.length} platform target(s) for post ${postId}`);

  // Get the post record
  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .single();

  if (!post) {
    return { success: false, results: [] };
  }

  const results: Array<{ platform: string; success: boolean; error?: string }> = [];

  // Publish to each platform sequentially (to respect rate limits)
  for (const pp of postPlatforms) {
    const socialAccount = pp.social_accounts as unknown as SocialAccount;

    try {
      await publishToPlatform({
        post,
        postPlatform: pp,
        socialAccount,
      });

      results.push({ platform: pp.platform, success: true });
    } catch (error) {
      results.push({
        platform: pp.platform,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Update post status based on results
  const allSucceeded = results.every((r) => r.success);
  const anySucceeded = results.some((r) => r.success);

  await supabase
    .from("posts")
    .update({
      status: allSucceeded ? "published" : "failed",
      published_at: anySucceeded ? new Date().toISOString() : null,
    })
    .eq("id", postId);

  return { success: allSucceeded, results };
}
