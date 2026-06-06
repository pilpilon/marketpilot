# Implementation Plan: Smart Asset Context (Screenshots + Feature Awareness)

## Problem Statement

Two related issues make MarketPilot's generated assets unreliable:

1. **Generic app visuals**: When AI generates assets showing "the app", it invents generic dashboards/graphs instead of the user's real product — because it has no visual reference.
2. **Feature overpromising**: Captions and scripts reference features the product doesn't have — because the brand intelligence pipeline extracts positioning/voice but NOT a structured feature list.

## Solution: Two Features

### Feature A: Project Screenshots (capture & approve flow)
### Feature B: Feature Registry (structured product capabilities)

Both feed into the existing asset generation pipeline to ground it in reality.

---

## Feature A: Project Screenshots

### Concept

During project setup (or from Intelligence page), capture screenshots of the user's website at desktop + mobile viewports. Show them to the user for approval. Store in Supabase Storage. Auto-inject as reference images during asset generation.

### Why No External API

Use **Puppeteer** in a dedicated API route with `@sparticuz/chromium-min`. The binary is fetched from a CDN at runtime (~45MB), fits within Vercel's 250MB function limit. This avoids any external API cost.

Alternatively, if Vercel Hobby's 10s timeout proves too tight, use **Browserless.io free tier** (1,000 units/month) as a drop-in replacement — same fetch-based pattern, zero cost.

### Data Model

**New table: `project_screenshots`**

```sql
CREATE TABLE project_screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewport text NOT NULL CHECK (viewport IN ('desktop', 'mobile')),
  storage_path text NOT NULL,
  public_url text NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_screenshots_project ON project_screenshots(project_id);
```

### Implementation Steps

#### Step 1: Screenshot Capture Module
**File**: `src/lib/screenshots/capture.ts` (NEW)

```pseudo
export async function captureScreenshot(url, viewport):
  // Option A: Puppeteer
  browser = puppeteer.connect(...) or puppeteer.launch(chromium)
  page.setViewport(viewport)  // desktop: 1280x800, mobile: 390x844
  page.goto(url, waitUntil: 'networkidle0', timeout: 8000)
  screenshot = page.screenshot({ type: 'png', fullPage: false })
  browser.close()
  return { buffer, width, height }

  // Option B (fallback): Browserless.io REST
  fetch(`https://chrome.browserless.io/screenshot?token=...`, {
    method: 'POST',
    body: JSON.stringify({ url, viewport: { width, height } })
  })
```

#### Step 2: Device Mockup Compositor
**File**: `src/lib/screenshots/mockup.ts` (NEW)

```pseudo
// Store 2-3 transparent device frame PNGs in public/mockups/
// iPhone 16 Pro (portrait), MacBook Pro, Generic browser

export async function createDeviceMockup(screenshotBuffer, device):
  frame = sharp(`public/mockups/${device}.png`)
  resized = sharp(screenshotBuffer).resize(SCREEN_SPECS[device])
  return frame.composite([{ input: resized, top: OFFSET.y, left: OFFSET.x }]).png()
```

Source frames from: github.com/jamesjingyi/mockup-device-frames (free, maintained)

#### Step 3: API Route for Capture + Store
**File**: `src/app/api/projects/[id]/screenshots/route.ts` (NEW)

```pseudo
POST /api/projects/[id]/screenshots:
  - Verify project ownership
  - Read project.url — if null, return 400 "No website URL configured"
  - Capture desktop (1280x800) + mobile (390x844) screenshots
  - Upload both to Supabase Storage: screenshots/{userId}/{projectId}/desktop.png
  - Insert rows into project_screenshots (approved: false)
  - Return { desktop: { url, id }, mobile: { url, id } }

PUT /api/projects/[id]/screenshots:
  - Approve or reject screenshots by ID
  - Update approved = true/false

GET /api/projects/[id]/screenshots:
  - Return all screenshots for project (for UI display)
```

#### Step 4: Trigger in Analysis Pipeline
**File**: `src/app/api/projects/[id]/analyze/route.ts` (MODIFY)

In the **"start"** step (after website scraping), also capture screenshots:

```pseudo
case "start":
  // ... existing scrape logic ...
  if (projectUrl) {
    try {
      await captureAndStoreScreenshots(supabase, projectId, userId, projectUrl)
    } catch {
      // Best-effort — don't block analysis if screenshot fails
    }
  }
```

#### Step 5: Intelligence Page UI — Screenshot Approval
**File**: `src/app/(dashboard)/dashboard/[projectId]/intelligence/page.tsx` (MODIFY)

Add a new section **above** the context files list:

```pseudo
"App Preview" section:
  - Show desktop + mobile screenshots side by side
  - "Approve" / "Reject" / "Refresh" buttons per screenshot
  - If no URL: "Add a website URL in project settings to capture app screenshots"
  - If no screenshots: "Capture Screenshots" button
  - Tooltip: "These screenshots help AI create marketing assets with YOUR real app interface"
```

#### Step 6: Auto-Inject into Creative Designer
**File**: `src/app/api/skills/creative-designer/route.ts` (MODIFY)

```pseudo
// After loading brand context, before generating:
if (!referenceImage?.base64) {
  // Check for approved project screenshots
  const { data: screenshots } = await supabase
    .from('project_screenshots')
    .select('public_url, viewport')
    .eq('project_id', projectId)
    .eq('approved', true)
    .limit(1)

  if (screenshots?.length) {
    // Fetch screenshot, create device mockup, inject as reference
    const screenshotBuffer = await fetch(screenshots[0].public_url).then(r => r.arrayBuffer())
    const mockup = await createDeviceMockup(Buffer.from(screenshotBuffer), 'iphone_15')
    referenceImage = { base64: mockup.toString('base64'), mimeType: 'image/png' }
  }
}
```

#### Step 7: Auto-Inject into Video Creator
**File**: `src/app/api/cron/process-video-jobs/route.ts` (MODIFY)

For scenes that describe the app/product, pass the screenshot as the initial reference image:

```pseudo
// Before scene generation loop:
const approvedScreenshot = await loadApprovedScreenshot(supabase, job.project_id)

// In scene loop:
if (scene.prompt.match(/\b(app|screen|interface|dashboard|website|platform)\b/i) && approvedScreenshot) {
  referenceImageBase64 = approvedScreenshot.base64
}
```

#### Step 8: Smart Prompt Enhancement
**File**: `src/lib/templates/prompt-builder.ts` (MODIFY)

When a screenshot reference is auto-injected (not user-uploaded), use a more specific instruction:

```pseudo
if (hasReferenceImage && isAutoScreenshot) {
  qualityLines.push(
    "- The reference image shows the ACTUAL app/website interface. Show this exact interface on a device screen in the scene. Do NOT replace it with generic graphics."
  )
}
```

---

## Feature B: Feature Registry

### Concept

During the analysis pipeline's "product" step, extract a structured list of **actual product features** from the scraped website. Store as a new context file type `features`. If the scrape doesn't yield clear features, prompt the user to input them manually. Use this registry to constrain captions and scripts.

### Data Model

Uses existing `context_files` table with new `file_type = 'features'`:

```sql
-- No migration needed — just add to the CHECK constraint
ALTER TABLE context_files
  DROP CONSTRAINT context_files_file_type_check,
  ADD CONSTRAINT context_files_file_type_check CHECK (
    file_type IN (
      'brand', 'product', 'audience', 'competitors',
      'intake', 'character_brief', 'visual_style',
      'sop', 'storytelling', 'features'
    )
  );
```

### Content Format (Markdown)

```markdown
## Confirmed Features
- Feature 1: Brief description
- Feature 2: Brief description
...

## Platform Type
- [x] Website
- [ ] Mobile App (iOS)
- [ ] Mobile App (Android)
- [ ] Desktop App
- [ ] Physical Product

## What This Product Does NOT Have
- No mobile app
- No AI chatbot
- ...
```

### Implementation Steps

#### Step 9: Feature Extraction in Analysis
**File**: `src/app/api/projects/[id]/analyze/route.ts` (MODIFY)

Add a new step **"features"** between "product" and "character":

```pseudo
case "features": {
  const websiteContent = /* from run metadata */
  const product = await readContextFile(supabase, projectId, "product")

  const result = await perplexitySynthesize(`
    Based on this website content and product brief, extract a STRUCTURED list of
    CONFIRMED features/capabilities of "${projectName}".

    Website content: ${websiteContent.slice(0, 3000)}
    Product brief: ${product.slice(0, 1500)}

    RULES:
    - Only list features you can VERIFY from the website content
    - Do NOT invent or assume features
    - If a feature is unclear, mark it as "Unverified: ..."
    - Determine the platform type (website, mobile app, desktop, physical)
    - List what the product explicitly does NOT have (if determinable)

    Output format:
    ## Confirmed Features
    - [feature]: [one-line description]

    ## Platform Type
    [checkboxes]

    ## Unverified / Needs User Input
    - [anything unclear]
  `)

  await saveContextFile(supabase, projectId, userId, "features", result)
  return NextResponse.json({ done: true })
}
```

#### Step 10: Features Tab in Intelligence Page
**File**: `src/app/(dashboard)/dashboard/[projectId]/intelligence/page.tsx` (MODIFY)

Add "features" to `FILE_TYPE_IDS`:

```pseudo
{ id: "features", labelKey: "labelFeatures", descKey: "descFeatures" }
```

With a special edit UI:
- Checkbox list for platform type (Website / iOS / Android / Desktop / Physical)
- Editable feature list
- "Add Feature" button
- "This product does NOT have:" section
- Warning banner if features file is empty: "Tell us what your product does so we create accurate marketing"

#### Step 11: i18n Keys
**Files**: `src/messages/en.json`, `src/messages/he.json` (MODIFY)

Add keys for:
- `labelFeatures`, `descFeatures`
- `labelAppPreview`, `descAppPreview`
- Screenshot approval UI strings
- Feature editor UI strings

#### Step 12: Inject Features into Caption Generation
**File**: `src/app/api/skills/creative-designer/route.ts` (MODIFY — caption section)

```pseudo
// Load features context
const features = await readContextFile(supabase, projectId, "features")

// Add to caption prompt:
`IMPORTANT — PRODUCT CAPABILITIES:
${features || "No feature list available — keep claims general"}

RULES:
- Only mention features listed above as "Confirmed"
- Do NOT promise features not in the list
- If the product is a website (not a mobile app), do NOT suggest "download the app"
- Match claims to actual capabilities`
```

#### Step 13: Inject Features into Video Script Generator
**File**: `src/lib/video/script-generator.ts` (MODIFY)

Add `features?: string` to the params and include in the prompt:

```pseudo
PRODUCT CAPABILITIES (only reference these — do NOT invent features):
${features || "Keep product claims general and vague"}

PLATFORM TYPE: ${platformType || "unknown — do not show app store or mobile device scenes unless confirmed"}
```

#### Step 14: Inject Features into buildImagePrompt
**File**: `src/lib/templates/prompt-builder.ts` (MODIFY)

Add `platformType?: string` param. If not mobile app:

```pseudo
if (platformType && !platformType.includes('mobile')) {
  qualityLines.push(
    "- This product is a WEBSITE, not a mobile app. Do NOT show smartphones, app stores, or mobile interfaces unless the reference image shows one."
  )
}
```

#### Step 15: Load Features in Brand Context
**File**: `src/lib/templates/brand-tokens.ts` (MODIFY `loadBrandContext`)

Add features extraction alongside existing context loading:

```pseudo
// In loadBrandContext:
const featuresFile = contextFiles.find(f => f.file_type === 'features')
return {
  ...existing,
  features: featuresFile?.content || '',
  platformType: extractPlatformType(featuresFile?.content)
}
```

---

## Execution Order

| # | Step | Files | Depends On |
|---|------|-------|------------|
| 1 | DB migration (screenshots table + features file_type) | `supabase/migrations/00008_screenshots_features.sql` | — |
| 2 | Screenshot capture module | `src/lib/screenshots/capture.ts` | — |
| 3 | Device mockup compositor | `src/lib/screenshots/mockup.ts` | Step 2 |
| 4 | Screenshot API route | `src/app/api/projects/[id]/screenshots/route.ts` | Steps 1-3 |
| 5 | Feature extraction in analysis | `src/app/api/projects/[id]/analyze/route.ts` | Step 1 |
| 6 | Features + Screenshots in Intelligence UI | `src/app/(dashboard)/dashboard/[projectId]/intelligence/page.tsx` | Steps 4-5 |
| 7 | i18n keys | `src/messages/en.json`, `src/messages/he.json` | — |
| 8 | Load features in brand context | `src/lib/templates/brand-tokens.ts` | Step 1 |
| 9 | Inject into Creative Designer | `src/app/api/skills/creative-designer/route.ts` | Steps 4, 8 |
| 10 | Inject into prompt builder | `src/lib/templates/prompt-builder.ts` | Step 8 |
| 11 | Inject into Video Creator | `src/lib/video/script-generator.ts`, `src/app/api/cron/process-video-jobs/route.ts` | Steps 4, 8 |
| 12 | Trigger screenshots in analysis | `src/app/api/projects/[id]/analyze/route.ts` | Step 4 |

Steps 1-3 and 7 can run in parallel. Steps 5, 8 can run in parallel.

---

## Key Design Decisions

1. **Screenshot approval before use**: User must approve screenshots — prevents auto-injecting broken/wrong pages into assets
2. **Feature extraction is best-effort**: AI extracts what it can from the website, user fills gaps manually
3. **Platform type drives visual decisions**: If no mobile app, AI won't generate phone-holding scenes
4. **Sharp compositing over AI inpainting**: Screenshots are pixel-perfect in device frames — AI doesn't distort them
5. **Puppeteer first, Browserless fallback**: Try self-hosted first (free), fall back to Browserless free tier if timeouts are an issue
6. **Features as guard rails**: Captions and scripts are constrained to only reference confirmed capabilities

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Puppeteer timeout on Vercel Hobby (10s) | Use `@sparticuz/chromium-min` with aggressive timeout (8s). Fallback: Browserless.io free tier |
| User never approves screenshots | Screenshots only enhance assets — not required. Pipeline works without them |
| Feature extraction misses capabilities | User can manually edit features in Intelligence page. Warning banner if empty |
| Sharp device frame alignment off | Use tested coordinate specs from mockup-device-frames repo. One-time setup |
| Screenshots become stale | Add "last captured" date. Suggest refresh after 30 days. Manual refresh button |

---

## Cost Impact

| Component | Cost |
|-----------|------|
| Puppeteer/Chromium (self-hosted) | $0 |
| Browserless.io (fallback) | $0 (1,000 free/mo) |
| Supabase Storage (screenshots) | ~$0 (within free tier) |
| Sharp compositing | $0 (runs in existing function) |
| Device frame PNGs | $0 (open source) |
| Feature extraction (Perplexity) | ~$0.01/project (one API call) |
| **Total** | **$0/month** |

---

## Task Type
- [x] Frontend (Intelligence page UI)
- [x] Backend (capture, mockup, feature extraction, injection)
- [x] Fullstack
