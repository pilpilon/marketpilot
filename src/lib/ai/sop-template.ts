import { ProjectSettings } from "./locale-context";

/**
 * Generates a deterministic SOP document describing the research workflow.
 * This is a template — not AI-generated — so it accurately documents the procedure.
 */
export function generateSOP(
  projectName: string,
  settings: ProjectSettings,
  date: string
): string {
  const isHebrew = settings.locale === "he";
  const marketLabel = isHebrew ? "Israel (Hebrew)" : "Global (English)";

  return `# Standard Operating Procedure: Brand Intelligence Analysis
## Project: ${projectName}
## Generated: ${date}
## Target Market: ${marketLabel}

---

## 1. Input Collection

Before analysis begins, the following inputs are required:

| Field | Required | Purpose |
|-------|----------|---------|
| Project Name | Yes | Identifies the brand in research queries |
| Website URL | Recommended | Enables Perplexity to crawl and understand the brand |
| Description | Optional | Provides context when no website is available |
| Target Market | Optional | Focuses research on the correct geographic/cultural market |

---

## 2. Research Phase (Perplexity Sonar)

Two live web research queries are executed via the Perplexity Sonar API:

### Query 1: Competitor Research
- **Objective**: Identify 3-5 direct competitors
- **Data collected**: Company names, websites, positioning, target audience, differentiators, weaknesses, market share signals, social/content strategy
${isHebrew ? "- **Locale modifier**: Research is focused on Israeli companies and the Israeli market\n- **Sources**: Hebrew-language business directories, Israeli tech/business publications" : "- **Scope**: Global market unless specified otherwise"}

### Query 2: Audience Research
- **Objective**: Map the target audience
- **Data collected**: Buyer personas (demographics, psychographics), pain points, motivations, online behavior, evaluation process, common objections
${isHebrew ? "- **Locale modifier**: Focuses on Israeli consumer behavior, local platforms (Instagram, Facebook, TikTok, WhatsApp), and cultural context" : "- **Scope**: General market behavior patterns"}

### Fallback
If the Perplexity API key is not configured or the API returns an error, queries fall back to Google Gemini 2.5 Flash (training data only — no live web search).

---

## 3. Synthesis Phase (Google Gemini 2.5 Flash)

Research results feed into four synthesis prompts:

### Document 1: Brand Positioning
- **Input**: Competitor research + audience research
- **Output sections**: Brand promise, positioning statement, brand pillars, key differentiators, brand voice & tone
${isHebrew ? "- **Locale**: Accounts for Israeli market positioning, Hebrew communication style, and local cultural values" : ""}

### Document 2: Product Brief
- **Input**: Competitor research (truncated to 1000 chars)
- **Output sections**: Core value proposition, feature highlights, use cases, proof points, pricing context

### Document 3: Character Brief
- **Input**: Brand positioning document (truncated to 800 chars)
- **Output sections**: Brand personality, content tone examples ("We say / We don't say"), content themes, hashtag strategy (10-15 tags), content calendar themes
${isHebrew ? "- **Locale**: Includes Hebrew hashtag strategy and Israeli content themes" : ""}

### Document 4: Visual Style Guide
- **Input**: Brand positioning document (truncated to 600 chars)
- **Output sections**: Color palette direction, typography personality, imagery style, layout & composition, visual dos and don'ts

---

## 4. Output Storage

Six context files are created or updated in the database:

| File Type | Source | Description |
|-----------|--------|-------------|
| brand | Gemini synthesis | Brand positioning document |
| product | Gemini synthesis | Product marketing brief |
| audience | Perplexity research | Raw audience research findings |
| competitors | Perplexity research | Raw competitive landscape |
| character_brief | Gemini synthesis | Content creation guide |
| visual_style | Gemini synthesis | Visual direction guide |

- All files are stored with \`source: "auto"\` and \`version: 1\`
- Subsequent analyses overwrite existing files (version resets to 1)
- Manual edits by the user set \`source: "refined"\` and increment the version

---

## 5. Quality Assurance

After successful completion:
- [x] All 6 context files generated and stored
- [x] Project status updated to "active"
- [x] Analysis run logged with status "completed"
- [x] SOP document generated and stored

If any step fails:
- Analysis run is marked "failed" with error message
- Previously generated files from the same run are still stored (partial success is possible)

---

## 6. Manual Refinement

After the automated analysis:
1. Review each context file in the Intelligence tab
2. Click "Edit" to refine any section
3. Edits are tracked with version numbers and marked as "refined"
4. The refined context is what powers all downstream skills (captions, posts, campaigns)

**Recommendation**: Always review the Character Brief and Brand Positioning documents. These have the most impact on generated content quality.
`;
}
