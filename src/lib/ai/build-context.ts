import { SupabaseClient } from "@supabase/supabase-js";
import { parseProjectSettings, buildLocaleContext } from "@/lib/ai/locale-context";

/**
 * Builds the full brand intelligence context string for a project.
 * Pulls from: context_files, analysis_runs metadata, and recent campaign_assets.
 * This is what powers generate-caption, generate-hashtags, and auto-reply AI.
 */
export async function buildProjectContext(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
): Promise<string> {
  const sections: string[] = [];

  // 1. Core brand intelligence (context_files)
  const { data: contextFiles } = await supabase
    .from("context_files")
    .select("file_type, content, version, source")
    .eq("project_id", projectId)
    .order("file_type");

  if (contextFiles && contextFiles.length > 0) {
    const ORDER = ["brand", "product", "audience", "competitors", "character_brief", "visual_style", "intake"];
    const LABELS: Record<string, string> = {
      intake: "EXAMPLES & STYLE PATTERNS (voice/style DNA from past successful content)",
    };
    const sorted = [...(contextFiles as Array<{ file_type: string; content: string; version: number; source: string }>)].sort(
      (a, b) => ORDER.indexOf(a.file_type) - ORDER.indexOf(b.file_type)
    );
    for (const f of sorted) {
      const label = LABELS[f.file_type] ?? f.file_type.replace(/_/g, " ").toUpperCase();
      sections.push(
        `### ${label} (v${f.version}, ${f.source})\n${f.content}`
      );
    }
  }

  // 2. Proven campaign assets — sample approved/published post drafts as examples
  const { data: approvedAssets } = await supabase
    .from("campaign_assets")
    .select("asset_type, title, content")
    .eq("user_id", userId)
    .in("status", ["approved", "published"])
    .eq("asset_type", "post_draft")
    .order("created_at", { ascending: false })
    .limit(5);

  if (approvedAssets && approvedAssets.length > 0) {
    const examples = (approvedAssets as Array<{ title: string | null; content: string | null }>)
      .filter((a) => a.content)
      .map((a, i) => `Example ${i + 1}${a.title ? ` (${a.title})` : ""}:\n${a.content}`)
      .join("\n\n");

    if (examples) {
      sections.push(`### PROVEN POST EXAMPLES (approved/published)\nUse these as style and tone references:\n\n${examples}`);
    }
  }

  // 3. Active campaigns — current goals and messaging strategy
  const { data: activeCampaigns } = await supabase
    .from("campaigns")
    .select("name, campaign_type, goal, platforms")
    .eq("project_id", projectId)
    .eq("status", "active")
    .limit(3);

  if (activeCampaigns && activeCampaigns.length > 0) {
    const campaignSummary = (activeCampaigns as Array<{ name: string; campaign_type: string; goal: string | null; platforms: string[] }>)
      .map((c) => `- ${c.name} (${c.campaign_type})${c.goal ? `: ${c.goal}` : ""}`)
      .join("\n");
    sections.push(`### ACTIVE CAMPAIGNS\n${campaignSummary}`);
  }

  // 4. Locale/market context from project settings
  const { data: project } = await supabase
    .from("projects")
    .select("settings")
    .eq("id", projectId)
    .single();

  if (project) {
    const settings = parseProjectSettings(project.settings);
    const localeCtx = buildLocaleContext(settings);
    if (localeCtx.skillContext) {
      sections.push(`### LOCALE & MARKET CONTEXT${localeCtx.skillContext}`);
    }
  }

  if (sections.length === 0) {
    return "";
  }

  return `## BRAND INTELLIGENCE CONTEXT\n\n${sections.join("\n\n---\n\n")}`;
}
