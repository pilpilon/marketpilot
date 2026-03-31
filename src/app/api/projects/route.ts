import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, url, description, settings, brandUrls } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Validate and sanitise brand URLs
  const validBrandUrls = Array.isArray(brandUrls)
    ? brandUrls
        .filter((b: { url?: string }) => b?.url?.trim())
        .map((b: { url: string; type?: string; label?: string }) => ({
          url: b.url.trim(),
          type: b.type ?? "other",
          ...(b.label ? { label: b.label.trim() } : {}),
        }))
    : [];

  // Generate slug from name
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Ensure unique slug for this user
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", user.id)
    .eq("slug", slug)
    .single();

  const finalSlug = existing
    ? `${slug}-${Date.now().toString(36)}`
    : slug;

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: name.trim(),
      slug: finalSlug,
      url: url?.trim() || null,
      brand_urls: validBrandUrls,
      description: description?.trim() || null,
      settings: settings && typeof settings === "object" ? settings : {},
      status: "setup",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ project }, { status: 201 });
}
