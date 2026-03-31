import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadBrandContext } from "@/lib/templates/brand-tokens";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, templateName, templateCategory, slides } = await request.json();

  if (!projectId || !slides?.length) {
    return NextResponse.json({ error: "projectId and slides are required" }, { status: 400 });
  }

  // Load brand context
  const { visual, brandPersonality } = await loadBrandContext(supabase, projectId);

  // Load additional context (product, audience, brand)
  const { data: contextFiles } = await supabase
    .from("context_files")
    .select("file_type, content")
    .eq("project_id", projectId)
    .in("file_type", ["brand", "product", "audience"]);

  const files = (contextFiles || []) as Array<{ file_type: string; content: string }>;
  const brandFile = files.find((f) => f.file_type === "brand")?.content?.slice(0, 500) || "";
  const productFile = files.find((f) => f.file_type === "product")?.content?.slice(0, 500) || "";
  const audienceFile = files.find((f) => f.file_type === "audience")?.content?.slice(0, 300) || "";

  // Detect language from user locale and brand context
  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .single();
  const locale = (profile as { locale: string } | null)?.locale || "en";

  // Also check if brand context contains Hebrew characters
  const allContext = [brandFile, productFile, audienceFile, brandPersonality].join(" ");
  const hasHebrew = /[\u0590-\u05FF]/.test(allContext);
  const outputLanguage = locale === "he" || hasHebrew ? "Hebrew (עברית)" : "English";

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_AI_API_KEY not configured" }, { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // Build the prompt to fill all template fields
  const slideDescriptions = slides.map((slide: { slideId: string; name: string; role: string; fields: Array<{ id: string; label: string; placeholder?: string; maxLength?: number; required: boolean }> }) => {
    const fieldList = slide.fields
      .map((f) => `  - "${f.id}" (${f.label}${f.required ? ", REQUIRED" : ", optional"}${f.maxLength ? `, max ${f.maxLength} chars` : ""}${f.placeholder ? `, example format: ${f.placeholder}` : ""})`)
      .join("\n");
    return `Slide "${slide.slideId}" (${slide.name}, role: ${slide.role}):\n${fieldList}`;
  }).join("\n\n");

  const prompt = `You are a social media copywriter. Generate compelling text content for a "${templateName}" (${templateCategory}) social media post template.

CRITICAL: You MUST write ALL generated text in ${outputLanguage}. Every field value must be in ${outputLanguage}. Do not mix languages.

BRAND CONTEXT:
${brandPersonality}

${brandFile ? `BRAND INFO:\n${brandFile}\n` : ""}
${productFile ? `PRODUCT/SERVICE:\n${productFile}\n` : ""}
${audienceFile ? `TARGET AUDIENCE:\n${audienceFile}\n` : ""}
VISUAL STYLE CONTEXT:
${visual.styleKeywords}

TEMPLATE SLIDES TO FILL:
${slideDescriptions}

INSTRUCTIONS:
- Generate engaging, on-brand copy for each field
- Respect max character limits strictly
- Make headlines punchy and attention-grabbing
- Subheadlines should add context or detail
- CTAs should be action-oriented (e.g. "Shop Now", "Learn More", "Get Started")
- For quote templates: the "headline" field is the quote itself (an inspiring statement that fits the brand voice). The "attribution" field MUST be a person's name or title with a dash prefix (e.g. "— Sarah Cohen, CEO" or "— The BestRest Team"). NEVER put a tagline or slogan in attribution.
- For testimonial templates: the "headline" is a customer testimonial quote. The "attribution" is the customer's name and role.
- For carousel templates, make each slide build on the previous one with a cohesive narrative
- Match the brand's tone and personality
- ALL text MUST be in ${outputLanguage} — this is non-negotiable
- Keep text natural and fluent — never generate awkward or grammatically broken text

Respond ONLY with valid JSON in this exact format:
{
  "slides": {
    "<slideId>": {
      "<fieldId>": "generated text"
    }
  }
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
