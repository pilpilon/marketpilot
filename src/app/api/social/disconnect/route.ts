import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { deleteVaultSecret } from "@/lib/social/token-manager";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { socialAccountId } = await request.json();

  if (!socialAccountId) {
    return NextResponse.json(
      { error: "socialAccountId is required" },
      { status: 400 }
    );
  }

  // Fetch the account to get vault secret IDs
  const { data: account } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("id", socialAccountId)
    .eq("user_id", user.id)
    .single();

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Delete vault secrets
  if (account.access_token_secret_id) {
    await deleteVaultSecret(account.access_token_secret_id);
  }
  if (account.refresh_token_secret_id) {
    await deleteVaultSecret(account.refresh_token_secret_id);
  }

  // Facebook and Instagram are user-level connections cloned per project.
  // Disconnecting one removes the entire connection + any derived Instagram rows.
  if (account.platform === "facebook") {
    await supabase
      .from("social_accounts")
      .delete()
      .eq("user_id", user.id)
      .in("platform", ["facebook", "instagram"]);
  } else if (account.platform === "instagram") {
    await supabase
      .from("social_accounts")
      .delete()
      .eq("user_id", user.id)
      .eq("platform", "instagram")
      .eq("platform_user_id", account.platform_user_id);
  } else {
    // Per-project platforms (twitter, tiktok, linkedin): single-row delete
    await supabase
      .from("social_accounts")
      .delete()
      .eq("id", socialAccountId)
      .eq("user_id", user.id);
  }

  return NextResponse.json({ success: true });
}
