import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { captureScreenshot, VIEWPORTS } from "@/lib/screenshots/capture";
import { ensureDeviceFrames } from "@/lib/screenshots/mockup";

export const maxDuration = 30;

/**
 * GET /api/projects/[id]/screenshots
 * Returns all screenshots for the project.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: screenshots } = await supabase
    .from("project_screenshots")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ screenshots: screenshots ?? [] });
}

/**
 * POST /api/projects/[id]/screenshots
 * Captures desktop + mobile screenshots of the project's website URL.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership + get URL
  const { data: project } = await supabase
    .from("projects")
    .select("id, url")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const projectUrl = project.url as string | null;
  if (!projectUrl) {
    return NextResponse.json(
      { error: "No website URL configured for this project" },
      { status: 400 }
    );
  }

  // Ensure device frame PNGs exist
  try {
    await ensureDeviceFrames();
  } catch {
    // Non-critical — mockup frames are only used later in compositing
  }

  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: Array<{
    id: string;
    viewport: string;
    publicUrl: string;
    width: number;
    height: number;
  }> = [];

  // Capture both viewports
  for (const viewport of ["desktop", "mobile"] as const) {
    try {
      const capture = await captureScreenshot(projectUrl, viewport);
      const spec = VIEWPORTS[viewport];
      const fileName = `screenshots/${user.id}/${projectId}/${viewport}-${Date.now()}.png`;

      const { error: uploadError } = await serviceSupabase.storage
        .from("generated-images")
        .upload(fileName, capture.buffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.error(`[screenshots] Upload failed for ${viewport}:`, uploadError.message);
        continue;
      }

      const { data: urlData } = serviceSupabase.storage
        .from("generated-images")
        .getPublicUrl(fileName);

      // Delete old screenshots for this viewport
      await supabase
        .from("project_screenshots")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .eq("viewport", viewport);

      // Insert new screenshot
      const { data: row } = await supabase
        .from("project_screenshots")
        .insert({
          project_id: projectId,
          user_id: user.id,
          viewport,
          storage_path: fileName,
          public_url: urlData.publicUrl,
          width: spec.width * (spec.deviceScaleFactor ?? 2),
          height: spec.height * (spec.deviceScaleFactor ?? 2),
          approved: false,
          screenshot_type: "landing",
        })
        .select("id")
        .single();

      if (row) {
        results.push({
          id: (row as { id: string }).id,
          viewport,
          publicUrl: urlData.publicUrl,
          width: spec.width * (spec.deviceScaleFactor ?? 2),
          height: spec.height * (spec.deviceScaleFactor ?? 2),
        });
      }
    } catch (err) {
      console.error(
        `[screenshots] Capture failed for ${viewport}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (results.length === 0) {
    return NextResponse.json(
      { error: "Failed to capture any screenshots. This may be due to the website being unreachable or a timeout during rendering." },
      { status: 500 }
    );
  }

  return NextResponse.json({ screenshots: results });
}

/**
 * PUT /api/projects/[id]/screenshots
 * Approve or reject a screenshot.
 * Body: { screenshotId: string, approved: boolean }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { screenshotId, approved } = await request.json();

  if (!screenshotId || typeof approved !== "boolean") {
    return NextResponse.json(
      { error: "screenshotId and approved (boolean) are required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("project_screenshots")
    .update({ approved })
    .eq("id", screenshotId)
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

/**
 * PATCH /api/projects/[id]/screenshots
 * Upload a product screenshot (user-provided, not auto-captured).
 * Body: { base64: string, mimeType: string, viewport: "desktop" | "mobile" }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { base64, mimeType, viewport = "mobile" } = await request.json();

  if (!base64 || !mimeType) {
    return NextResponse.json(
      { error: "base64 and mimeType are required" },
      { status: 400 }
    );
  }

  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const ext = mimeType === "image/jpeg" ? "jpg" : "png";
  const fileName = `screenshots/${user.id}/${projectId}/product-${viewport}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(base64, "base64");

  const { error: uploadError } = await serviceSupabase.storage
    .from("generated-images")
    .upload(fileName, buffer, { contentType: mimeType, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = serviceSupabase.storage
    .from("generated-images")
    .getPublicUrl(fileName);

  const { data: row, error: insertError } = await supabase
    .from("project_screenshots")
    .insert({
      project_id: projectId,
      user_id: user.id,
      viewport,
      storage_path: fileName,
      public_url: urlData.publicUrl,
      width: 0,
      height: 0,
      approved: true, // user-uploaded = pre-approved
      screenshot_type: "product",
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    screenshot: {
      id: (row as { id: string }).id,
      viewport,
      publicUrl: urlData.publicUrl,
      screenshot_type: "product",
      approved: true,
    },
  });
}
