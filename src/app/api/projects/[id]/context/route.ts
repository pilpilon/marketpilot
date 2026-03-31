import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: files } = await supabase
    .from("context_files")
    .select("*")
    .eq("project_id", projectId)
    .order("file_type");

  return NextResponse.json({ files: files || [] });
}

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

  const { fileType, content } = await request.json();

  if (!fileType || content === undefined) {
    return NextResponse.json({ error: "fileType and content required" }, { status: 400 });
  }

  // Verify project ownership
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: existing } = await supabase
    .from("context_files")
    .select("id, version")
    .eq("project_id", projectId)
    .eq("file_type", fileType)
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from("context_files")
      .update({
        content,
        source: "refined",
        version: ((existing as { version: number }).version || 1) + 1,
      })
      .eq("id", (existing as { id: string }).id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ file: data });
  } else {
    const { data, error } = await supabase
      .from("context_files")
      .insert({
        project_id: projectId,
        user_id: user.id,
        file_type: fileType,
        content,
        source: "manual",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ file: data });
  }
}
