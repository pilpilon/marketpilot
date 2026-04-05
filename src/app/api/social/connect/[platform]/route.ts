import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  generateState,
  generateCodeVerifier,
  generateCodeChallenge,
  buildAuthorizationUrl,
  getOAuthConfig,
} from "@/lib/social/oauth";
import type { Platform } from "@/types/database";

const VALID_PLATFORMS = ["twitter", "instagram", "tiktok", "facebook"] as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;

  if (!VALID_PLATFORMS.includes(platform as Platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let projectId = searchParams.get("projectId");

  if (projectId) {
    // Verify project ownership when a specific project is targeted
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
  } else {
    // User-level connect (from Settings → Social). Facebook callback fans out
    // across all the user's projects, so we just need any project to satisfy
    // the oauth_states FK constraint.
    const { data: anyProject } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!anyProject) {
      return NextResponse.json(
        { error: "Create a project before connecting social accounts." },
        { status: 400 }
      );
    }
    projectId = anyProject.id;
  }

  const state = generateState();
  const config = getOAuthConfig(platform as Platform);
  let codeVerifier: string | undefined;
  let codeChallenge: string | undefined;

  if (config.usePKCE) {
    codeVerifier = generateCodeVerifier();
    codeChallenge = generateCodeChallenge(codeVerifier);
  }

  const { origin } = new URL(request.url);
  const redirectUri = `${origin}/api/social/callback/${platform}`;

  // Store state for CSRF validation
  const { error: stateError } = await supabase.from("oauth_states").insert({
    user_id: user.id,
    platform: platform as Platform,
    state_token: state,
    code_verifier: codeVerifier || null,
    project_id: projectId,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
  });

  if (stateError) {
    console.error(`[social-connect] Failed to store OAuth state:`, stateError.message);
    return NextResponse.json({ error: "Failed to initiate OAuth" }, { status: 500 });
  }

  const authUrl = buildAuthorizationUrl(
    platform as Platform,
    redirectUri,
    state,
    codeChallenge
  );

  return NextResponse.redirect(authUrl);
}
