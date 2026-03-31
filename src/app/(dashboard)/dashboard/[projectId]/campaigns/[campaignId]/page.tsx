import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Copy, Send } from "lucide-react";
import { CampaignAssetCard } from "@/components/campaigns/campaign-asset-card";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; campaignId: string }>;
}) {
  const { projectId, campaignId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .single();

  if (!campaign) redirect(`/dashboard/${projectId}/campaigns`);

  const { data: assets } = await supabase
    .from("campaign_assets")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at");

  type Asset = {
    id: string;
    title: string | null;
    content: string | null;
    storage_path: string | null;
    asset_type: string;
    status: string;
    created_at: string;
    metadata?: Record<string, unknown> | null;
  };

  const assetRows = (assets || []) as Asset[];

  const TYPE_LABELS: Record<string, string> = {
    social_media: "Social Media",
    email: "Email",
    video_ad: "Video Ad",
    content_marketing: "Content Marketing",
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/${projectId}/campaigns`}>
            <ArrowLeft className="me-2 h-4 w-4" />
            All Campaigns
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">{campaign.name as string}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary">
              {TYPE_LABELS[(campaign.campaign_type as string)] || (campaign.campaign_type as string)}
            </Badge>
            <Badge variant={(campaign.status as string) === "active" ? "default" : "outline"}>
              {campaign.status as string}
            </Badge>
            {(campaign.goal as string | null) && (
              <span className="text-sm text-muted-foreground">
                Goal: {campaign.goal as string}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/${projectId}/compose?campaignId=${campaignId}`}>
              <Send className="me-2 h-4 w-4" />
              Publish to Social
            </Link>
          </Button>
        </div>
      </div>

      {assetRows.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">No assets in this campaign yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {assetRows.length} Asset{assetRows.length !== 1 ? "s" : ""}
            </h2>
          </div>
          {assetRows.map((asset) => (
            <CampaignAssetCard
              key={asset.id}
              asset={asset}
              projectId={projectId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
