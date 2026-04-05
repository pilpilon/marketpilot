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

    // For Facebook, link the SAME connection to every project the user owns.
    // Meta's "Facebook Login for Business" is scoped per (user, app), not per project —
    // trying to re-auth per-project loses previously-granted assets. So we connect once
    // and clone the row across all the user's projects.
    const { data: userProjects } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", user.id);
    const projectIds: string[] =
      platform === "facebook"
        ? (userProjects?.map((p) => p.id) || [oauthState.project_id])
        : [oauthState.project_id];

    const rows = projectIds.map((pid) => ({
      user_id: user.id,
      project_id: pid,
      platform: platform as Platform,
      platform_user_id: profile.id,
      platform_username: profile.username,
      platform_display_name: profile.displayName,
      platform_avatar_url: profile.avatarUrl,
      access_token_secret_id: accessSecretId,
      refresh_token_secret_id: refreshSecretId,
      token_expires_at: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
      scopes: tokens.scope ? tokens.scope.split(" ") : [],
      status: "active" as const,
      connected_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase
      .from("social_accounts")
      .upsert(rows, { onConflict: "project_id,platform,platform_user_id" });

    if (upsertError) {
      console.error(`[social-callback] DB upsert failed:`, upsertError.message);
      throw new Error(`DB upsert failed: ${upsertError.message}`);
    }
    console.log(`[social-callback] Linked ${platform} connection to ${projectIds.length} project(s)`);

    // When Facebook connects, auto-link an Instagram social_account for EVERY project the user owns
    // by discovering the IG Business account on each project's matching page.
    // The IG social_account row is metadata only — publisher uses the FB user token at publish time.
    if (platform === "facebook") {
      try {
        const pagesRes = await fetch(
          `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,instagram_business_account{id,username,name,profile_picture_url}&access_token=${tokens.accessToken}`
        );
        if (pagesRes.ok) {
          const pagesData = await pagesRes.json();
          const pages: Array<{ id: string; name: string; instagram_business_account?: { id: string; username?: string; name?: string; profile_picture_url?: string } }> = pagesData.data || [];
          const withIg = pages.filter((p) => p.instagram_business_account?.id);
          const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

          // Get each of the user's projects with its name
          const { data: allProjects } = await supabase
            .from("projects")
            .select("id, name")
            .eq("user_id", user.id);

          for (const proj of allProjects || []) {
            const target = norm(proj.name);
            const chosen =
              withIg.find((p) => norm(p.name) === target) ||
              withIg.find((p) => norm(p.name).includes(target) || target.includes(norm(p.name))) ||
              null;
            if (!chosen?.instagram_business_account) {
              console.log(`[social-callback] No IG business account matched project "${proj.name}" — skipping`);
              continue;
            }
            const ig = chosen.instagram_business_account;
            console.log(`[social-callback] Auto-linking IG ${ig.id} (${ig.username}) to project "${proj.name}" via page "${chosen.name}"`);
            await supabase.from("social_accounts").upsert(
              {
                user_id: user.id,
                project_id: proj.id,
                platform: "instagram",
                platform_user_id: ig.id,
                platform_username: ig.username || ig.id,
                platform_display_name: ig.name || ig.username || "",
                platform_avatar_url: ig.profile_picture_url || "",
                access_token_secret_id: accessSecretId,
                refresh_token_secret_id: refreshSecretId,
                token_expires_at: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
                scopes: tokens.scope ? tokens.scope.split(" ") : [],
                status: "active",
                connected_at: new Date().toISOString(),
                metadata: { derived_from: "facebook", page_id: chosen.id, page_name: chosen.name },
              },
              { onConflict: "project_id,platform,platform_user_id" }
            );

            // Relink any orphaned IG post_platforms rows for this project to the new IG account
            const { data: newIg } = await supabase
              .from("social_accounts")
              .select("id")
              .eq("project_id", proj.id)
              .eq("platform", "instagram")
              .eq("platform_user_id", ig.id)
              .maybeSingle();
            if (newIg?.id) {
              const { data: projPosts } = await supabase.from("posts").select("id").eq("project_id", proj.id);
              const postIds = projPosts?.map((p) => p.id) || [];
              if (postIds.length) {
                await supabase
                  .from("post_platforms")
                  .update({ social_account_id: newIg.id })
                  .is("social_account_id", null)
                  .eq("platform", "instagram")
                  .in("post_id", postIds);
              }
            }
          }
        }
      } catch (igErr) {
        console.error(`[social-callback] IG auto-link failed (non-fatal):`, igErr instanceof Error ? igErr.message : igErr);
      }
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
