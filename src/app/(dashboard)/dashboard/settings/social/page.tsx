import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SocialAccountCard } from "@/components/social/social-account-card";
import { ConnectButton } from "@/components/social/connect-button";
import type { Platform, Database } from "@/types/database";

type SocialAccount = Database["public"]["Tables"]["social_accounts"]["Row"];

const PLATFORM_IDS: Platform[] = ["facebook", "instagram", "twitter", "tiktok"];

export default async function GlobalSocialAccountsPage() {
  const t = await getTranslations("social");
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch ALL user's connections across projects, dedupe by (platform, platform_user_id)
  const { data: accounts } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("connected_at", { ascending: false });

  const typedAccounts = (accounts || []) as SocialAccount[];

  // Dedupe: one card per distinct (platform, platform_user_id). Pick the most recent row.
  const seen = new Set<string>();
  const dedupedByPlatform = new Map<Platform, SocialAccount>();
  for (const a of typedAccounts) {
    const key = `${a.platform}:${a.platform_user_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // For Facebook/Instagram (user-level), show only the first one.
    // For Twitter/TikTok, show one per account (but keep the first for now — simple).
    if (!dedupedByPlatform.has(a.platform as Platform)) {
      dedupedByPlatform.set(a.platform as Platform, a);
    }
  }

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
    name: t(platformNameKeys[id] as "twitterName" | "instagramName" | "facebookName" | "tiktokName"),
    description: t(platformDescKeys[id] as "twitterDescription" | "instagramDescription" | "facebookDescription" | "tiktokDescription"),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          One connection shared across every project in your account. Connect Facebook once — Instagram is linked automatically for each project by matching page names.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {platforms.map((platform) => {
          const account = dedupedByPlatform.get(platform.id);
          return account ? (
            <SocialAccountCard
              key={platform.id}
              account={account}
              platformInfo={platform}
            />
          ) : (
            <ConnectButton
              key={platform.id}
              platform={platform}
            />
          );
        })}
      </div>
    </div>
  );
}
