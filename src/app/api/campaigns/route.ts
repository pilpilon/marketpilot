import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function DELETE(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids } = await request.json();

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array is required" }, { status: 400 });
  }

  // Delete posts linked to these campaigns (post_platforms + post_media cascade from posts)
  await supabase
    .from("posts")
    .delete()
    .in("campaign_id", ids)
    .eq("user_id", user.id);

  // Delete campaign assets (foreign key)
  await supabase
    .from("campaign_assets")
    .delete()
    .in("campaign_id", ids)
    .eq("user_id", user.id);

  // Delete campaigns
  const { error } = await supabase
    .from("campaigns")
    .delete()
    .in("id", ids)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: ids.length });
}
