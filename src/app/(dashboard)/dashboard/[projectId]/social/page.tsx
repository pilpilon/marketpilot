import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SocialAccountCard } from "@/components/social/social-account-card";
import { ConnectButton } from "@/components/social/connect-button";
import type { Platform, Database } from "@/types/database";

type SocialAccount = Database["public"]["Tables"]["social_accounts"]["Row"];

const PLATFORM_IDS: Platform[] = ["twitter", "instagram", "facebook", "tiktok"];

export default async function SocialAccountsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const t = await getTranslations("social");
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

  const platformNameKeys: Record<Platform, string> = {
    twitter: "twitterName",
    instagram: "instagramName",
    facebook: "facebookName",
    tiktok: "tiktokName",
  };

  const platformDescKeys: Record<Platform, string> = {
    twitter: "twitterDescription",
    instagram: "instagramDescription",
    facebook: "facebookDescription",
    tiktok: "tiktokDescription",
  };

  const platforms = PLATFORM_IDS.map((id) => ({
    id,
    name: t(platformNameKeys[id] as any),
    description: t(platformDescKeys[id] as any),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("description")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {platforms.map((platform) => {
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
