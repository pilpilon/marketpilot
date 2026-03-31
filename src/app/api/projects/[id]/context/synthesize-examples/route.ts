import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(
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
    .select("id, name")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Fetch all attachments with extracted pattern analyses
  const { data: attachments } = await supabase
    .from("context_attachments")
    .select("file_name, file_type, extracted_text, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  const validAttachments = (attachments || []).filter(
    (a) => a.extracted_text && !a.extracted_text.startsWith("[Pattern analysis failed")
  );

  if (validAttachments.length === 0) {
    return NextResponse.json(
      { error: "No analyzed examples found. Upload some content examples first." },
      { status: 400 }
    );
  }

  // Build the synthesis prompt
  const examplesBlock = validAttachments
    .map(
      (a, i) =>
        `--- EXAMPLE ${i + 1}: ${a.file_name} ---\n${a.extracted_text}`
    )
    .join("\n\n");

  const synthesisPrompt = `You are building a "Voice & Style DNA" brief for a brand's Examples Library.

You have pattern analyses from ${validAttachments.length} example${validAttachments.length > 1 ? "s" : ""} of this brand's successful content. Synthesize these into a unified, actionable style brief that captures what makes this brand's content distinctively theirs.

${examplesBlock}

---

Now synthesize a unified "Voice & Style DNA" brief with these sections:

## VOICE SIGNATURE
What is the brand's consistent writing voice? What personality comes through in every piece? What emotional register do they operate in? (2-3 sentences that capture the essence)

## SIGNATURE HOOK PATTERNS
What hook styles do they use most effectively? List the top 2-3 with a short example or description of how they execute each.

## CONTENT STRUCTURE PATTERNS
How do they typically organize their content? What narrative frameworks appear? How long are their pieces and what's the typical flow?

## LANGUAGE DNA
- Power words and phrases they favor
- Sentence rhythm and length patterns
- Punctuation and formatting style
- Any signature phrases or vocabulary

## HOW THEY DRIVE ACTION
How do they close content and prompt action? Soft-sell, direct, emotional, urgency-based?

## BRAND PERSONALITY SIGNALS
What values and personality traits consistently come through? What would feel "off-brand" based on these examples?

## REPLICATION GUIDE
3-5 specific, actionable rules a copywriter should follow to sound like this brand. Be concrete, not generic.

Be specific and quote from the examples where possible. This brief will be injected directly into AI prompts to generate new on-brand content.`;

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_AI_API_KEY not configured" }, { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  let synthesizedBrief: string;
  try {
    const result = await model.generateContent(synthesisPrompt);
    synthesizedBrief = result.response.text().trim();
  } catch (err) {
    return NextResponse.json(
      { error: `Synthesis failed: ${err instanceof Error ? err.message : "unknown error"}` },
      { status: 500 }
    );
  }

  // Upsert the intake context file with the synthesized brief
  const { data: existing } = await supabase
    .from("context_files")
    .select("id, version")
    .eq("project_id", projectId)
    .eq("file_type", "intake")
    .single();

  let contextFile;

  if (existing) {
    const { data: updated } = await supabase
      .from("context_files")
      .update({
        content: synthesizedBrief,
        source: "ai",
        version: ((existing as { version: number }).version || 1) + 1,
      })
      .eq("id", (existing as { id: string }).id)
      .select()
      .single();
    contextFile = updated;
  } else {
    const { data: created } = await supabase
      .from("context_files")
      .insert({
        project_id: projectId,
        user_id: user.id,
        file_type: "intake",
        content: synthesizedBrief,
        source: "ai",
      })
      .select()
      .single();
    contextFile = created;
  }

  return NextResponse.json({
    contextFile,
    examplesProcessed: validAttachments.length,
  });
}
