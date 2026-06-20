import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      {
        error: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Max size is ${MAX_FILE_SIZE / (1024 * 1024)} MB` },
      { status: 400 }
    );
  }

  // Build a unique path: <userId>/<timestamp>-<filename>
  const ext = file.name.split(".").pop() || "";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const filePath = `${user.id}/${fileName}`;

  const { data, error } = await supabase.storage
    .from("post-media")
    .upload(filePath, file, {
      contentType: file.type,
      cacheControl: "3600",
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get the public URL
  const { data: publicUrlData } = supabase.storage
    .from("post-media")
    .getPublicUrl(data.path);

  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

  return NextResponse.json({
    url: publicUrlData.publicUrl,
    path: data.path,
    mediaType: isVideo ? "video" : "image",
  });
}
