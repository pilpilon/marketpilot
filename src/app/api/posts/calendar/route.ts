import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!projectId || !start || !end) {
    return NextResponse.json(
      { error: "projectId, start, and end are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("posts")
    .select("*, post_platforms(id, platform, caption, status, published_at)")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .gte("scheduled_at", start)
    .lte("scheduled_at", end)
    .in("status", ["scheduled", "published", "failed"])
    .order("scheduled_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by date for calendar rendering
  const grouped: Record<string, typeof data> = {};
  for (const post of data || []) {
    if (post.scheduled_at) {
      const dateKey = post.scheduled_at.split("T")[0];
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(post);
    }
  }

  return NextResponse.json(grouped);
}
