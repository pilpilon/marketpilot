import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/social/oauth";
import { storeTokenInVault } from "@/lib/social/token-manager";
import { getPlatformClient } from "@/lib/social/platforms";
import type { Platform } from "@/types/database";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/dashboard?error=oauth_denied&platform=${platform}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/dashboard?error=missing_oauth_params`
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  // Validate state token
  const { data: oauthState } = await supabase
    .from("oauth_states")
    .select("*")
    .eq("state_token", state)
    .eq("user_id", user.id)
    .single();

  if (!oauthState) {
    return NextResponse.redirect(
      `${appUrl}/dashboard?error=invalid_oauth_state`
    );
  }

  // Check expiry
  if (new Date(oauthState.expires_at) < new Date()) {
    await supabase.from("oauth_states").delete().eq("id", oauthState.id);
    return NextResponse.redirect(
      `${appUrl}/dashboard?error=oauth_state_expired`
    );
  }

  // Delete the used state
  await supabase.from("oauth_states").delete().eq("id", oauthState.id);

  try {
    const redirectUri = `${appUrl}/api/social/callback/${platform}`;

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(
      platform as Platform,
      code,
      redirectUri,
      oauthState.code_verifier || undefined
    );

    // Get user profile from the platform
    const client = getPlatformClient(platform as Platform);
    const profile = await client.getUserProfile(tokens.accessToken);

    // Store tokens in Vault
    const accessSecretId = await storeTokenInVault(
      tokens.accessToken,
      `${platform}_access_${user.id}_${profile.id}`
    );

    let refreshSecretId: string | null = null;
    if (tokens.refreshToken) {
      refreshSecretId = await storeTokenInVault(
        tokens.refreshToken,
        `${platform}_refresh_${user.id}_${profile.id}`
      );
    }

    // Upsert social account
    await supabase.from("social_accounts").upsert(
      {
        user_id: user.id,
        project_id: oauthState.project_id,
        platform: platform as Platform,
        platform_user_id: profile.id,
        platform_username: profile.username,
        platform_display_name: profile.displayName,
        platform_avatar_url: profile.avatarUrl,
        access_token_secret_id: accessSecretId,
        refresh_token_secret_id: refreshSecretId,
        token_expires_at: new Date(
          Date.now() + tokens.expiresIn * 1000
        ).toISOString(),
        scopes: tokens.scope ? tokens.scope.split(" ") : [],
        status: "active",
        connected_at: new Date().toISOString(),
      },
      {
        onConflict: "project_id,platform,platform_user_id",
      }
    );

    return NextResponse.redirect(
      `${appUrl}/dashboard/${oauthState.project_id}/social?connected=${platform}`
    );
  } catch (err) {
    console.error(`OAuth callback error for ${platform}:`, err);
    return NextResponse.redirect(
      `${appUrl}/dashboard?error=oauth_exchange_failed&platform=${platform}`
    );
  }
}
