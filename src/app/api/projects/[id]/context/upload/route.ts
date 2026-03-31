import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export async function POST(
  request: Request,
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

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Parse FormData
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large. Maximum 20MB." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Accepted: PDF, images (PNG/JPG/WebP), PPTX." },
      { status: 400 }
    );
  }

  // Read file as buffer and base64
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64Data = buffer.toString("base64");

  // 1. Upload to Supabase Storage
  const serviceSupabase = await createServiceRoleClient();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${user.id}/${projectId}/${Date.now()}-${sanitizedName}`;

  const { error: uploadError } = await serviceSupabase.storage
    .from("intake-uploads")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = serviceSupabase.storage
    .from("intake-uploads")
    .getPublicUrl(storagePath);

  const publicUrl = urlData.publicUrl;

  // 2. Analyze for style patterns via Gemini multimodal
  let extractedText = "";
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const analysisPrompt = `You are analyzing an example of successful brand content for an Examples Library. Your goal is to extract the underlying style patterns so they can be replicated in future content.

Analyze this content and extract structured pattern notes covering:

**VOICE & TONE**
- Writing style (conversational, authoritative, playful, etc.)
- Formality level
- Personality traits that come through
- Emotional register

**HOOK PATTERNS**
- How does the content open?
- What hook type is used? (curiosity gap, bold claim, pain point, story, question, data, etc.)
- What makes it attention-grabbing?

**CONTENT STRUCTURE**
- How is the content organized?
- What narrative framework is followed? (PAS, BAB, storytelling, list, etc.)
- Paragraph/section length and flow

**LANGUAGE PATTERNS**
- Recurring phrases or vocabulary
- Power words used
- Sentence length and rhythm
- Punctuation style (em dashes, ellipses, etc.)
- Use of numbers, specificity, or data

**CALL TO ACTION**
- How does the content end?
- What action is prompted and how?
- Urgency or soft-sell approach?

**BRAND SIGNALS**
- What values does this content project?
- What does it reveal about the brand's personality?
- Any consistent themes or motifs?

${file.type.startsWith("image/") ? "**VISUAL ELEMENTS**\n- Colors, typography, layout\n- Text overlay style\n- Compositional approach\n\n" : ""}Format as structured notes under each heading. Be specific — use direct quotes where possible.`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      },
      analysisPrompt,
    ]);

    extractedText = result.response.text().trim();
  } catch (err) {
    // Analysis failed — still save the file
    extractedText = `[Pattern analysis failed for ${file.name}: ${err instanceof Error ? err.message : "unknown error"}]`;
  }

  // 3. Find or create intake context_file (placeholder until Synthesize is run)
  let contextFileId: string;

  const { data: existing } = await supabase
    .from("context_files")
    .select("id, content, version")
    .eq("project_id", projectId)
    .eq("file_type", "intake")
    .single();

  if (existing) {
    contextFileId = (existing as { id: string }).id;
  } else {
    const { data: created, error: createError } = await supabase
      .from("context_files")
      .insert({
        project_id: projectId,
        user_id: user.id,
        file_type: "intake",
        content: `Examples uploaded. Click "Synthesize Examples" to generate a unified style brief from your uploaded content.`,
        source: "manual",
      })
      .select("id")
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
    contextFileId = (created as { id: string }).id;
  }

  // 4. Insert context_attachment record
  const { data: attachment, error: attachError } = await supabase
    .from("context_attachments")
    .insert({
      context_file_id: contextFileId,
      project_id: projectId,
      user_id: user.id,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: storagePath,
      public_url: publicUrl,
      extracted_text: extractedText,
    })
    .select()
    .single();

  if (attachError) {
    return NextResponse.json({ error: attachError.message }, { status: 500 });
  }

  return NextResponse.json({
    attachment,
    contextFile: null,
  });
}
