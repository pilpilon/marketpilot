import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "20");

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, campaign_type, created_at, campaign_assets(id)")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  return NextResponse.json({ campaigns: campaigns || [] });
}
