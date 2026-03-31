import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

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

  // Verify project ownership
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: attachments } = await supabase
    .from("context_attachments")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ attachments: attachments || [] });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attachmentId } = await request.json();

  if (!attachmentId) {
    return NextResponse.json({ error: "attachmentId required" }, { status: 400 });
  }

  // Fetch the attachment to get storage path
  const { data: attachment } = await supabase
    .from("context_attachments")
    .select("id, storage_path")
    .eq("id", attachmentId)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  // Delete from storage using service role
  const serviceSupabase = await createServiceRoleClient();
  await serviceSupabase.storage
    .from("intake-uploads")
    .remove([(attachment as { storage_path: string }).storage_path]);

  // Delete from database
  const { error } = await supabase
    .from("context_attachments")
    .delete()
    .eq("id", attachmentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
