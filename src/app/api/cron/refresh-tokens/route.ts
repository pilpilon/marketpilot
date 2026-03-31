import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { refreshAccountTokens } from "@/lib/social/token-manager";
import type { Database } from "@/types/database";

type SocialAccount = Database["public"]["Tables"]["social_accounts"]["Row"];

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceRoleClient();

  // Find accounts with tokens expiring within 12 hours
  const twelveHoursFromNow = new Date(
    Date.now() + 12 * 60 * 60 * 1000
  ).toISOString();

  const { data: accounts, error } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("status", "active")
    .not("refresh_token_secret_id", "is", null)
    .lte("token_expires_at", twelveHoursFromNow);

  if (error) {
    console.error("Failed to fetch accounts for refresh:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ refreshed: 0 });
  }

  let refreshed = 0;
  let failed = 0;

  for (const account of accounts as SocialAccount[]) {
    try {
      await refreshAccountTokens(account);
      refreshed++;
    } catch (err) {
      console.error(
        `Token refresh failed for ${account.platform}/${account.platform_username}:`,
        err
      );
      failed++;
    }
  }

  return NextResponse.json({ refreshed, failed, total: accounts.length });
}
