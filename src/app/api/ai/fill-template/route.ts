import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadBrandContext } from "@/lib/templates/brand-tokens";

function cleanEnvValue(value: string | undefined): string | undefined {
  const cleaned = value?.trim().replace(/(?:\\r|\\n)+$/g, "").trim();
  return cleaned || undefined;
}

function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  return text.slice(first, last + 1).trim();
}

function parseAiJson<T>(text: string): T {
  const jsonText = extractJsonObject(text);
  if (!jsonText) throw new Error("AI response did not contain JSON");
  return JSON.parse(jsonText) as T;
}

function inferProductName(projectName: string, context: string): string {
  const detectedNames = context.match(/\b[A-Z][A-Za-z0-9]*(?:[A-Z][A-Za-z0-9]*)+\b/g) || [];
  const names = [projectName, ...detectedNames]
    .map((name) => name.trim())
    .filter(Boolean);
  return names[0] || "the product";
}

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

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();
  const projectName = (project as { name?: string } | null)?.name || "";

  // Load brand context
  const { visual, brandPersonality, brandPositioning, productContext, audienceContext, features } = await loadBrandContext(supabase, projectId);

  // Load additional raw context so short template fields can stay specific.
  const { data: contextFiles } = await supabase
    .from("context_files")
    .select("file_type, content")
    .eq("project_id", projectId)
    .in("file_type", ["brand", "product", "audience", "features", "intake"]);

  const files = (contextFiles || []) as Array<{ file_type: string; content: string }>;
  const brandFile = files.find((f) => f.file_type === "brand")?.content?.slice(0, 1600) || "";
  const productFile = files.find((f) => f.file_type === "product")?.content?.slice(0, 1600) || "";
  const audienceFile = files.find((f) => f.file_type === "audience")?.content?.slice(0, 1000) || "";
  const featuresFile = files.find((f) => f.file_type === "features")?.content?.slice(0, 1800) || features.slice(0, 1800) || "";
  const intakeFile = files.find((f) => f.file_type === "intake")?.content?.slice(0, 1000) || "";

  // Detect language from user locale and brand context
  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .single();
  const locale = (profile as { locale: string } | null)?.locale || "en";

  const allContext = [
    projectName,
    brandFile,
    productFile,
    audienceFile,
    featuresFile,
    intakeFile,
    brandPersonality,
    brandPositioning,
    productContext,
    audienceContext,
  ].join(" ");
  const hasHebrew = /[\u0590-\u05FF]/.test(allContext);
  const outputLanguage = locale === "he" || hasHebrew ? "Hebrew (עברית)" : "English";
  const productName = inferProductName(projectName, allContext);

  const apiKey = cleanEnvValue(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const client = new OpenAI({ apiKey });
  const model = cleanEnvValue(process.env.OPENAI_TEXT_MODEL) || cleanEnvValue(process.env.CHAT_MODEL) || "gpt-4o-mini";

  const slideDescriptions = slides.map((slide: { slideId: string; name: string; role: string; fields: Array<{ id: string; label: string; placeholder?: string; maxLength?: number; required: boolean }> }) => {
    const fieldList = slide.fields
      .map((f) => `  - "${f.id}" (${f.label}${f.required ? ", REQUIRED" : ", optional"}${f.maxLength ? `, max ${f.maxLength} chars` : ""}${f.placeholder ? `, example format: ${f.placeholder}` : ""})`)
      .join("\n");
    return `Slide "${slide.slideId}" (${slide.name}, role: ${slide.role}):\n${fieldList}`;
  }).join("\n\n");

  const prompt = `You are a senior performance copywriter for B2B SaaS/local-business software. Generate precise text content for a "${templateName}" (${templateCategory}) social media post template.

CRITICAL LANGUAGE RULE: Write ALL generated field values in ${outputLanguage}. Do not mix languages.

PROJECT / PRODUCT NAME:
${productName}

BRAND CONTEXT:
${brandPersonality}

${projectName ? `PROJECT NAME:\n${projectName}\n` : ""}
${brandPositioning ? `BRAND POSITIONING SUMMARY:\n${brandPositioning}\n` : ""}
${productContext ? `PRODUCT SUMMARY:\n${productContext}\n` : ""}
${audienceContext ? `TARGET AUDIENCE SUMMARY:\n${audienceContext}\n` : ""}
${brandFile ? `RAW BRAND INFO:\n${brandFile}\n` : ""}
${productFile ? `RAW PRODUCT/SERVICE INFO:\n${productFile}\n` : ""}
${featuresFile ? `CONFIRMED PRODUCT CAPABILITIES — use ONLY these, do not invent features:\n${featuresFile}\n` : ""}
${audienceFile ? `RAW TARGET AUDIENCE:\n${audienceFile}\n` : ""}
${intakeFile ? `INTAKE / PRIORITY CONTEXT:\n${intakeFile}\n` : ""}
VISUAL STYLE CONTEXT:
${visual.styleKeywords}

TEMPLATE SLIDES TO FILL:
${slideDescriptions}

COPY QUALITY RULES:
- Mention the product/brand name when it fits the field length. For this project, do not hide behind "your business" or "your brand".
- Anchor the copy in a concrete buyer pain point from the context. Avoid generic SaaS slogans.
- For restaurant/inventory software, prefer pains like messy stock counts, invoice/OCR review, supplier chaos, missing items, manual spreadsheets, reorder/min-stock confusion, or wasted manager time — but ONLY if supported by the confirmed context.
- Use this structure when possible: specific pain → product mechanism → concrete operational benefit → CTA.
- Headlines must be sharp and specific, not broad. Bad: "Manage your business with AI". Good: "BestRest turns supplier invoices into stock updates".
- Key-benefit fields must explain what problem is fixed and how, not just "save time".
- CTA fields should be direct and practical.
- Respect max character limits strictly.
- Never invent customers, metrics, guarantees, integrations, prices, or features.
- For quote/testimonial templates, follow the field-specific rules from the template role and labels.
- Return strict JSON only. Escape quote characters inside text values. No markdown, no comments, no trailing commas.

Respond ONLY with valid JSON in this exact format:
{
  "slides": {
    "<slideId>": {
      "<fieldId>": "generated text"
    }
  }
}`;

  try {
    const result = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return only valid JSON. Write concise, specific, on-brand marketing copy." },
        { role: "user", content: prompt },
      ],
      temperature: 0.65,
    });

    const text = result.choices[0]?.message?.content || "";
    const parsed = parseAiJson<{ slides?: Record<string, Record<string, string>> }>(text);
    return NextResponse.json(parsed);
  } catch (err) {
    const msg = err instanceof Error && !err.message.includes("JSON")
      ? err.message
      : "AI returned invalid template copy. Please try again.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
