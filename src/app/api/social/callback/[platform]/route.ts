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
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  // Use request origin (actual production URL) instead of env var
  const appUrl = origin;

  console.log(`[social-callback] platform=${platform} origin=${origin} code=${code ? "present" : "missing"} state=${state ? "present" : "missing"} error=${error || "none"}`);

  if (error) {
    console.log(`[social-callback] OAuth denied: ${error}`);
    return NextResponse.redirect(
      `${appUrl}/dashboard?error=oauth_denied&platform=${platform}`
    );
  }

  if (!code || !state) {
    console.log(`[social-callback] Missing params: code=${!!code} state=${!!state}`);
    return NextResponse.redirect(
      `${appUrl}/dashboard?error=missing_oauth_params`
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log(`[social-callback] No authenticated user`);
    return NextResponse.redirect(`${appUrl}/login`);
  }

  // Validate state token
  const { data: oauthState, error: stateError } = await supabase
    .from("oauth_states")
    .select("*")
    .eq("state_token", state)
    .eq("user_id", user.id)
    .single();

  if (!oauthState) {
    console.log(`[social-callback] Invalid state token. stateError=${stateError?.message}`);
    return NextResponse.redirect(
      `${appUrl}/dashboard?error=invalid_oauth_state`
    );
  }

  // Check expiry
  if (new Date(oauthState.expires_at) < new Date()) {
    console.log(`[social-callback] State expired: ${oauthState.expires_at}`);
    await supabase.from("oauth_states").delete().eq("id", oauthState.id);
    return NextResponse.redirect(
      `${appUrl}/dashboard?error=oauth_state_expired`
    );
  }

  // Delete the used state
  await supabase.from("oauth_states").delete().eq("id", oauthState.id);

  try {
    const redirectUri = `${appUrl}/api/social/callback/${platform}`;

    console.log(`[social-callback] Exchanging code. redirectUri=${redirectUri}`);
    const tokens = await exchangeCodeForTokens(
      platform as Platform,
      code,
      redirectUri,
      oauthState.code_verifier || undefined
    );

    console.log(`[social-callback] Token exchange OK. Getting profile...`);
    const client = getPlatformClient(platform as Platform);
    const profile = await client.getUserProfile(tokens.accessToken);
    console.log(`[social-callback] Profile: id=${profile.id} username=${profile.username}`);

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

    console.log(`[social-callback] Tokens stored. Upserting social_accounts...`);

    // Upsert social account
    const { error: upsertError } = await supabase.from("social_accounts").upsert(
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

    if (upsertError) {
      console.error(`[social-callback] DB upsert failed:`, upsertError.message);
      throw new Error(`DB upsert failed: ${upsertError.message}`);
    }

    console.log(`[social-callback] SUCCESS. Redirecting to social page.`);
    return NextResponse.redirect(
      `${appUrl}/dashboard/${oauthState.project_id}/social?connected=${platform}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[social-callback] FAILED for ${platform}:`, msg);
    return NextResponse.redirect(
      `${appUrl}/dashboard?error=oauth_exchange_failed&platform=${platform}&detail=${encodeURIComponent(msg)}`
    );
  }
}
