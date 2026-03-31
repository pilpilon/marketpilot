import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ComposeEditor } from "@/components/compose/compose-editor";
import type { Database } from "@/types/database";

type SocialAccount = Database["public"]["Tables"]["social_accounts"]["Row"];

export default async function ComposePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ campaignId?: string }>;
}) {
  const { projectId } = await params;
  const { campaignId } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch connected social accounts for this project
  const { data: accounts } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("status", "active");

  // If campaignId provided, load assets to pre-fill caption/hashtags/media
  let initialCaption: string | undefined;
  let initialHashtags: string[] | undefined;
  let initialMediaUrls: string[] | undefined;

  if (campaignId) {
    const { data: assets } = await supabase
      .from("campaign_assets")
      .select("content, storage_path, metadata, asset_type")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true });

    if (assets) {
      // Collect media URLs from image assets
      const mediaUrls = assets
        .filter((a) => (a.asset_type === "image" || a.asset_type === "template_render") && a.storage_path)
        .map((a) => a.storage_path as string);

      if (mediaUrls.length > 0) {
        initialMediaUrls = mediaUrls;
      }

      // Find caption + hashtags from the first asset that has them in metadata
      const assetWithCaption = assets.find(
        (a) => (a.metadata as Record<string, unknown>)?.caption
      );

      if (assetWithCaption) {
        const meta = assetWithCaption.metadata as Record<string, unknown>;
        initialCaption = meta.caption as string;
        const tags = meta.hashtags as string[] | undefined;
        if (tags && tags.length > 0) {
          initialHashtags = tags;
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight">Create Post</h1>
        <p className="text-muted-foreground mt-1">
          Compose and publish content across your social platforms
        </p>
      </div>

      <ComposeEditor
        projectId={projectId}
        accounts={(accounts || []) as SocialAccount[]}
        initialCaption={initialCaption}
        initialHashtags={initialHashtags}
        initialMediaUrls={initialMediaUrls}
        campaignId={campaignId}
      />
    </div>
  );
}
