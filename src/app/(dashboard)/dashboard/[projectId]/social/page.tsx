import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SocialAccountCard } from "@/components/social/social-account-card";
import { ConnectButton } from "@/components/social/connect-button";
import type { Platform, Database } from "@/types/database";

type SocialAccount = Database["public"]["Tables"]["social_accounts"]["Row"];

const PLATFORMS: { id: Platform; name: string; description: string }[] = [
  {
    id: "twitter",
    name: "X (Twitter)",
    description: "Post tweets, threads, and engage with your audience",
  },
  {
    id: "instagram",
    name: "Instagram",
    description: "Share photos, reels, and stories to your followers",
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "Upload short videos and engage with trends",
  },
];

export default async function SocialAccountsPage({
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

  const { data: accounts } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  const typedAccounts = (accounts || []) as SocialAccount[];
  const connectedMap = new Map(
    typedAccounts.map((a) => [a.platform, a])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight">Social Accounts</h1>
        <p className="text-muted-foreground mt-1">
          Connect your social media accounts to publish content
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((platform) => {
          const account = connectedMap.get(platform.id);
          return account ? (
            <SocialAccountCard
              key={platform.id}
              account={account}
              platformInfo={platform}
              projectId={projectId}
            />
          ) : (
            <ConnectButton
              key={platform.id}
              platform={platform}
              projectId={projectId}
            />
          );
        })}
      </div>
    </div>
  );
}
