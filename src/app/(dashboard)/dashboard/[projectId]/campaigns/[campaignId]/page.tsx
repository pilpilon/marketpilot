import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, AlertTriangle, CalendarDays, Loader2, Send } from "lucide-react";
import { CampaignAssetCard } from "@/components/campaigns/campaign-asset-card";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; campaignId: string }>;
}) {
  const t = await getTranslations("campaignDetail");
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

  const { data: campaignPosts } = await supabase
    .from("posts")
    .select("id, status, scheduled_at")
    .eq("campaign_id", campaignId)
    .eq("user_id", user.id)
    .order("scheduled_at", { ascending: true });

  const { data: activeJob } = await supabase
    .from("pipeline_jobs")
    .select("status, current_step, total_posts, completed_posts, updated_at")
    .eq("campaign_id", campaignId)
    .in("status", ["pending", "planning", "generating", "scheduling"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  type Asset = {
    id: string;
    title: string | null;
    content: string | null;
    storage_path: string | null;
    asset_type: string;
    status: string;
    created_at: string;
    carousel_group_id?: string | null;
    slide_order?: number | null;
    metadata?: Record<string, unknown> | null;
  };

  type GroupedAsset = Asset & { slideCount: number; slideAssets: Asset[] };

  const assetRows = (assets || []) as Asset[];
  const groupedAssets: GroupedAsset[] = [];
  const groups = new Map<string, Asset[]>();
  const standalone: Asset[] = [];

  for (const asset of assetRows) {
    if (asset.carousel_group_id) {
      const key = asset.carousel_group_id;
      groups.set(key, [...(groups.get(key) || []), asset]);
    } else {
      standalone.push(asset);
    }
  }

  for (const slides of groups.values()) {
    const sortedSlides = slides.sort((a, b) => (a.slide_order ?? 0) - (b.slide_order ?? 0));
    groupedAssets.push({
      ...sortedSlides[0],
      title: sortedSlides[0].title?.replace(/ visual$/i, " carousel") || sortedSlides[0].title,
      slideCount: sortedSlides.length,
      slideAssets: sortedSlides,
    });
  }

  for (const asset of standalone) {
    groupedAssets.push({ ...asset, slideCount: 1, slideAssets: [asset] });
  }

  groupedAssets.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const slideCount = assetRows.length;
  const postCount = groupedAssets.length;
  const scheduledPosts = (campaignPosts || []).filter((post) => post.status === "scheduled" && post.scheduled_at);
  const draftPosts = (campaignPosts || []).filter((post) => post.status === "draft");
  const hasCalendarPosts = (campaignPosts || []).length > 0;
  const isMultiPostCalendar = (campaign.campaign_type as string) === "content_marketing" && postCount > 1;
  const jobLooksStale = false;

  const TYPE_LABELS: Record<string, string> = {
    social_media: t("typeSocialMedia"),
    email: t("typeEmail"),
    video_ad: t("typeVideoAd"),
    content_marketing: t("typeContentMarketing"),
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/${projectId}/campaigns`}>
            <ArrowLeft className="me-2 h-4 w-4" />
            {t("allCampaigns")}
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
                {t("goal", { goal: campaign.goal as string })}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {activeJob ? (
            <Button variant="outline" size="sm" disabled>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {t("generatingCalendar")}
            </Button>
          ) : hasCalendarPosts ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/${projectId}/calendar`}>
                <CalendarDays className="me-2 h-4 w-4" />
                {t("viewScheduledCalendar")}
              </Link>
            </Button>
          ) : isMultiPostCalendar ? (
            <Button variant="outline" size="sm" disabled>
              <AlertTriangle className="me-2 h-4 w-4" />
              {t("calendarNotScheduled")}
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/${projectId}/compose?campaignId=${campaignId}`}>
                <Send className="me-2 h-4 w-4" />
                {t("publishToSocial")}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {activeJob && (
        <Card className={jobLooksStale ? "border-amber-300 bg-amber-50" : "border-purple-200 bg-purple-50"}>
          <CardContent className="py-4 text-sm">
            <div className="flex items-start gap-3">
              {jobLooksStale ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              ) : (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-purple-600" />
              )}
              <div>
                <p className="font-medium text-foreground">
                  {jobLooksStale ? t("generationPossiblyStuckTitle") : t("generationInProgressTitle")}
                </p>
                <p className="text-muted-foreground">
                  {t("generationInProgressDesc", {
                    step: ((activeJob as { current_step?: string | null }).current_step || "Generating posts").replace(/images/g, "posts"),
                    completed: (activeJob as { completed_posts?: number | null }).completed_posts ?? postCount,
                    total: (activeJob as { total_posts?: number | null }).total_posts ?? postCount,
                    slides: slideCount,
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hasCalendarPosts && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="font-medium text-foreground">{t("calendarPublishingTitle")}</p>
                <p>
                  {t("calendarPublishingDesc", {
                    scheduled: scheduledPosts.length,
                    drafts: draftPosts.length,
                    posts: (campaignPosts || []).length,
                    slides: slideCount,
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {assetRows.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">{t("noAssets")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {postCount} posts / {slideCount} slides
            </h2>
          </div>
          {groupedAssets.map((asset) => (
            <CampaignAssetCard
              key={asset.carousel_group_id || asset.id}
              asset={asset}
              projectId={projectId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
