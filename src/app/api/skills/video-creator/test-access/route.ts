import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface TestAccessInput {
  projectId?: string;
  demoUrl?: string;
  demoEmail?: string;
  demoPassword?: string;
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as TestAccessInput;
    const { projectId, demoUrl, demoEmail, demoPassword } = body;

    if (!projectId || !demoUrl) {
      return NextResponse.json(
        { error: "projectId and demoUrl are required" },
        { status: 400 }
      );
    }

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { verifyProductDemoAccess } = await import("@/lib/video/product-demo-recorder");
    const result = await verifyProductDemoAccess({
      demoUrl,
      demoEmail,
      demoPassword,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Demo access failed";
    return NextResponse.json(
      {
        ok: false,
        error: "Demo access failed",
        message,
        finalUrl: "",
      },
      { status: 422 }
    );
  }
}
