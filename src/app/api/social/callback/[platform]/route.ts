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

  // Validate state token (use .limit(1) to handle duplicates from retries)
  const { data: oauthStates, error: stateError } = await supabase
    .from("oauth_states")
    .select("*")
    .eq("state_token", state)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const oauthState = oauthStates?.[0];

  if (!oauthState) {
    // State already consumed (likely a double-redirect from the platform).
    // Instead of showing an error, just redirect to dashboard — the account
    // was probably saved by the first callback.
    console.log(`[social-callback] State already consumed (double-redirect). Redirecting to dashboard.`);
    return NextResponse.redirect(`${appUrl}/dashboard`);
  }

  // Check expiry
  if (new Date(oauthState.expires_at) < new Date()) {
    console.log(`[social-callback] State expired: ${oauthState.expires_at}`);
    await supabase.from("oauth_states").delete().eq("id", oauthState.id);
    return NextResponse.redirect(
      `${appUrl}/dashboard?error=oauth_state_expired`
    );
  }

  // Delete the used state (and any duplicates for this token)
  await supabase.from("oauth_states").delete().eq("state_token", state);

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
    let profile: { id: string; username: string; displayName: string; avatarUrl: string };
    let pageAccessToken = tokens.accessToken;

    if (platform === "instagram") {
      // Instagram via Facebook Login: discover the IG Business Account via Pages API
      console.log(`[social-callback] Instagram: discovering IG Business Account via Facebook Pages API`);

      // 1. Get user's Facebook Pages
      const pagesRes = await fetch(
        `https://graph.facebook.com/v22.0/me/accounts?access_token=${tokens.accessToken}`
      );
      if (!pagesRes.ok) {
        const pagesErr = await pagesRes.text();
        throw new Error(`Failed to get Facebook Pages: ${pagesErr}`);
      }
      const pagesData = await pagesRes.json();
      const pages = pagesData.data || [];
      console.log(`[social-callback] Instagram: found ${pages.length} Facebook Page(s)`);

      // 2. Find the page with an instagram_business_account
      let igAccountId = "";
      for (const page of pages) {
        const igRes = await fetch(
          `https://graph.facebook.com/v22.0/${page.id}?fields=instagram_business_account&access_token=${tokens.accessToken}`
        );
        if (igRes.ok) {
          const igData = await igRes.json();
          if (igData.instagram_business_account?.id) {
            igAccountId = igData.instagram_business_account.id;
            pageAccessToken = page.access_token;
            console.log(`[social-callback] Instagram: found IG Business Account ${igAccountId} on page ${page.name} (${page.id})`);
            break;
          }
        }
      }

      if (!igAccountId) {
        throw new Error("No Instagram Business Account found on any of your Facebook Pages. Make sure your Instagram Professional account is linked to a Facebook Page.");
      }

      // 3. Get the IG account profile
      const igProfileRes = await fetch(
        `https://graph.facebook.com/v22.0/${igAccountId}?fields=username,name,profile_picture_url&access_token=${pageAccessToken}`
      );
      if (igProfileRes.ok) {
        const igProfile = await igProfileRes.json();
        profile = {
          id: igAccountId,
          username: igProfile.username || igAccountId,
          displayName: igProfile.name || "",
          avatarUrl: igProfile.profile_picture_url || "",
        };
      } else {
        profile = { id: igAccountId, username: igAccountId, displayName: "", avatarUrl: "" };
      }

      // Use the Page access token for publishing (not the user token)
      tokens.accessToken = pageAccessToken;
    } else if (platform === "facebook") {
      // Facebook: discover the user's Pages and store the Page (not the user profile).
      // This ensures each project publishes to the correct Page when the user manages multiple.
      console.log(`[social-callback] Facebook: discovering Pages via /me/accounts`);
      const fbPagesRes = await fetch(
        `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token,picture.type(large)&access_token=${tokens.accessToken}`
      );
      if (!fbPagesRes.ok) {
        throw new Error(`Failed to get Facebook Pages: ${await fbPagesRes.text()}`);
      }
      const fbPagesData = await fbPagesRes.json();
      const fbPages = fbPagesData.data || [];
      console.log(`[social-callback] Facebook: found ${fbPages.length} Page(s)`);

      if (fbPages.length === 0) {
        throw new Error("No Facebook Pages found. You need a Facebook Page to publish.");
      }

      // Pick a page not already connected to another project for this user
      const { data: existingFbAccounts } = await supabase
        .from("social_accounts")
        .select("platform_user_id, project_id")
        .eq("user_id", user.id)
        .eq("platform", "facebook")
        .eq("status", "active");

      const usedPageIds = new Set(
        (existingFbAccounts || [])
          .filter((a) => a.project_id !== oauthState.project_id)
          .map((a) => a.platform_user_id)
      );

      const selectedPage = fbPages.find((p: { id: string }) => !usedPageIds.has(p.id)) || fbPages[0];
      console.log(`[social-callback] Facebook: selected Page "${selectedPage.name}" (${selectedPage.id})`);

      profile = {
        id: selectedPage.id,
        username: selectedPage.name || selectedPage.id,
        displayName: selectedPage.name || "",
        avatarUrl: selectedPage.picture?.data?.url || "",
      };

      // Use the Page access token for publishing (not the user token)
      pageAccessToken = selectedPage.access_token;
      tokens.accessToken = pageAccessToken;
    } else {
      const client = getPlatformClient(platform as Platform);
      profile = await client.getUserProfile(tokens.accessToken);
    }
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
