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
    .in("status", ["scheduled", "publishing", "published", "failed"])
    // Scheduled posts belong on their scheduled date; already-published immediate posts
    // often have no scheduled_at, so include their published_at/created_at date too.
    .or(
      `and(scheduled_at.gte.${start},scheduled_at.lte.${end}),` +
        `and(published_at.gte.${start},published_at.lte.${end}),` +
        `and(status.eq.published,created_at.gte.${start},created_at.lte.${end})`
    )
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by the date the post appears on the calendar.
  // Scheduled posts use scheduled_at; immediate/live posts use published_at or created_at.
  const grouped: Record<string, Array<Record<string, unknown>>> = {};
  for (const post of data || []) {
    const calendarAt = post.scheduled_at || post.published_at || post.created_at;
    if (calendarAt) {
      const dateKey = calendarAt.split("T")[0];
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push({ ...post, calendar_at: calendarAt });
    }
  }

  return NextResponse.json(grouped);
}
