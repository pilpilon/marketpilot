import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyProductDemoAccess } from "@/lib/video/product-demo-recorder";

interface TestAccessInput {
  projectId?: string;
  demoUrl?: string;
  demoEmail?: string;
  demoPassword?: string;
}

export async function POST(request: Request) {
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

  const result = await verifyProductDemoAccess({
    demoUrl,
    demoEmail,
    demoPassword,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
