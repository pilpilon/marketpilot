import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { publishPost } from "@/lib/social/publisher";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ownership and that post is in a publishable state
  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", ["draft", "scheduled", "failed"])
    .single();

  if (!post) {
    return NextResponse.json(
      { error: "Post not found or not in a publishable state" },
      { status: 404 }
    );
  }

  const result = await publishPost(id);

  return NextResponse.json(result);
}
