import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { CampaignList } from "@/components/campaigns/campaign-list";

export default async function CampaignsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
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
  };

  const rows = (campaigns || []) as CampaignRow[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            All generated assets and campaigns for this project
          </p>
        </div>
        <Button
          className="primary-gradient text-white border-0 hover:opacity-90 font-heading font-semibold"
          asChild
        >
          <Link href={`/dashboard/${projectId}/skills`}>
            <Zap className="mr-2 h-4 w-4" />
            New Campaign
          </Link>
        </Button>
      </div>

      <CampaignList campaigns={rows} projectId={projectId} />
    </div>
  );
}
