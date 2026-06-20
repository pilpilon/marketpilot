import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * External API endpoint for Hermes to list connected social accounts.
 * Authenticates with CRON_SECRET.
 *
 * GET /api/external/accounts?projectId=<uuid>
 * Authorization: Bearer *** *
 *
 * Returns the connected platforms and their account IDs, so Hermes knows
 * which platforms it can schedule posts for.
 */
export async function GET(request: Request) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId query parameter is required" },
      { status: 400 }
    );
  }

  const supabase = await createServiceRoleClient();

  // Get project info
  const { data: project, error: projError } = await supabase
    .from("projects")
    .select("id, name, slug, status")
    .eq("id", projectId)
    .single();

  if (projError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Get connected social accounts
  const { data: accounts, error: saError } = await supabase
    .from("social_accounts")
    .select("id, platform, platform_username, platform_display_name, status")
    .eq("project_id", projectId)
    .eq("status", "active");

  if (saError) {
    return NextResponse.json(
      { error: "Failed to fetch social accounts" },
      { status: 500 }
    );
  }

  // Build a summary of what's connected
  const connectedPlatforms = (accounts || []).map(
    (a: {
      id: string;
      platform: string;
      platform_username: string | null;
      platform_display_name: string | null;
      status: string;
    }) => ({
      accountId: a.id,
      platform: a.platform,
      username: a.platform_username,
      displayName: a.platform_display_name,
      status: a.status,
    })
  );

  // Instagram rides on Facebook's token, so if facebook is connected, instagram is available
  const hasFacebook = connectedPlatforms.some((p) => p.platform === "facebook");
  const availablePlatforms = connectedPlatforms.map((p) => p.platform);
  if (hasFacebook && !availablePlatforms.includes("instagram")) {
    availablePlatforms.push("instagram");
  }

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      status: project.status,
    },
    connectedAccounts: connectedPlatforms,
    availablePlatforms,
  });
}
