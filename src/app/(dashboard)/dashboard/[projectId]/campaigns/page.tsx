import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { CampaignList } from "@/components/campaigns/campaign-list";

export default async function CampaignsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const t = await getTranslations("campaigns");
  const { projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) redirect("/dashboard");

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*, campaign_assets(id), posts(id, status)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  // Fetch active pipeline jobs for this project's campaigns
  const campaignIds = (campaigns || []).map((c: { id: string }) => c.id);
  const { data: pipelineJobs } = campaignIds.length > 0
    ? await supabase
        .from("pipeline_jobs")
        .select("campaign_id, status, current_step, total_posts, completed_posts")
        .in("campaign_id", campaignIds)
        .in("status", ["pending", "planning", "generating", "scheduling"])
    : { data: [] };

  const jobByCampaign = new Map(
    (pipelineJobs || []).map((j: { campaign_id: string; status: string; current_step: string; total_posts: number | null; completed_posts: number | null }) => [j.campaign_id, j])
  );

  type CampaignRow = {
    id: string;
    name: string;
    campaign_type: string;
    status: string;
    goal: string | null;
    platforms: string[];
    created_at: string;
    campaign_assets: Array<{ id: string }>;
    posts: Array<{ id: string; status: string }>;
    pipelineJob?: { status: string; currentStep: string; totalPosts: number | null; completedPosts: number | null };
  };

  const rows = (campaigns || []).map((c: any) => {
    const job = jobByCampaign.get(c.id);
    return {
      ...c,
      pipelineJob: job ? { status: job.status, currentStep: job.current_step, totalPosts: job.total_posts, completedPosts: job.completed_posts } : undefined,
    };
  }) as CampaignRow[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>
        <Button
          className="primary-gradient text-white border-0 hover:opacity-90 font-heading font-semibold"
          asChild
        >
          <Link href={`/dashboard/${projectId}/skills`}>
            <Zap className="me-2 h-4 w-4" />
            {t("newCampaign")}
          </Link>
        </Button>
      </div>

      <CampaignList campaigns={rows} projectId={projectId} />
    </div>
  );
}
