# Auto-Screenshot for Real App Assets: Research Report
*Generated: 2026-04-06 | Sources: 15+ | Confidence: High*

## Executive Summary

When MarketPilot's Creative Designer or Video Creator generates marketing assets, they sometimes depict "an app" using generic stock-like images (graphs, dashboards) instead of the user's **actual** app/website. The root cause: the AI (Gemini/Veo) has no visual knowledge of the user's real product — it only has text descriptions.

**The fix**: Automatically capture a screenshot of the user's website URL and inject it into the asset pipeline as a reference image — even when the user hasn't manually uploaded one.

The recommended approach is a **two-stage pipeline**: (1) capture a real screenshot via a lightweight API, then (2) either composite it into a device mockup frame or pass it directly to Gemini/Veo as a reference image.

---

## Problem Analysis

### Current State
- User provides a **project URL** during project setup (stored in project context)
- Creative Designer already supports `referenceImage` — but only when the user **manually uploads** one
- When no reference image is provided, `hasReferenceImage` is hardcoded to `false`
- Gemini then invents generic "app-like" visuals from the text prompt alone

### What We Need
1. **Auto-capture**: When the user's project has a URL, automatically screenshot it
2. **Smart injection**: Feed that screenshot into the same reference image path that already exists
3. **Device framing** (optional): Place the screenshot inside a phone/laptop mockup frame for more polished results

---

## Solution Architecture

### Recommended: Screenshot API + Existing Reference Image Pipeline

```
User's Project URL
    ↓
Screenshot API (captures real website)
    ↓
[Optional] Device Mockup Frame (phone/laptop)
    ↓
Inject as referenceImage → Gemini/Veo
    ↓
AI generates scene WITH real app visuals
```

### Why Not Puppeteer/Playwright Directly?
- MarketPilot runs on **Vercel Hobby** — serverless functions have 50MB size limit
- Chromium binary alone is ~130MB+ (even with `@sparticuz/chromium-min` it's ~45MB)
- Cold starts are 5-15 seconds
- Memory-hungry (300MB+ per instance)
- **Verdict**: Too heavy for Vercel Hobby. Use an external API instead.

---

## Screenshot Capture Options

### Tier 1: Recommended APIs

| Service | Free Tier | Paid | Mobile Viewport | Quality |
|---------|-----------|------|-----------------|---------|
| **ScreenshotOne** | — | $19/mo (10K) | Yes | High |
| **URLbox** | — | $19/mo | Yes (retina) | High |
| **apiflash** | 100/mo | $9/mo | Yes | Good |
| **RenderScreenshot** | 50 credits | Usage-based | Yes (presets) | High |
| **capture.page** | — | Usage-based | Yes | Good |

### Tier 2: Budget/DIY Options

| Approach | Cost | Pros | Cons |
|----------|------|------|------|
| **Browserless.io** | ~$10/mo | Full Puppeteer API, hosted Chrome | Still need to write capture logic |
| **Supabase Edge Function + Puppeteer** | Free (within limits) | No extra service | Deno compatibility issues |
| **Google Cloud Run + Puppeteer** | ~$0/mo (free tier) | Full control, 2GB RAM | Extra infra to manage |

### Recommendation: **ScreenshotOne or apiflash**

For MarketPilot's use case (low volume — maybe 5-20 screenshots/day per active project):
- **apiflash** is the cheapest option with a free tier (100/mo)
- **ScreenshotOne** is more battle-tested with better viewport control
- Both support custom viewport dimensions (e.g., 390x844 for iPhone, 1280x720 for desktop)

### Simple API Call Example

```typescript
// apiflash example
const screenshotUrl = `https://api.apiflash.com/v1/urltoimage?access_key=${API_KEY}&url=${encodeURIComponent(siteUrl)}&width=390&height=844&format=png&quality=80`;
const response = await fetch(screenshotUrl);
const buffer = await response.arrayBuffer();
const base64 = Buffer.from(buffer).toString('base64');
```

---

## Device Mockup Options

### Why Mockup Frames?
A raw screenshot looks flat. Placing it inside an iPhone or MacBook frame:
- Makes it immediately recognizable as "an app"
- Looks more professional in marketing materials
- Gives Gemini/Veo better context about what the image represents

### Approach A: Pre-made PNG Frames + Sharp Compositing (Recommended)

MarketPilot already uses Sharp for image compositing (in the template pipeline). We can:

1. Store 2-3 device frame PNGs in `public/mockups/` (iPhone, MacBook, iPad)
2. Use Sharp to composite the screenshot into the frame
3. Output a single image ready for Gemini

```typescript
import sharp from 'sharp';

async function createDeviceMockup(
  screenshotBuffer: Buffer,
  device: 'iphone' | 'macbook' | 'ipad'
) {
  const frame = await sharp(`public/mockups/${device}-frame.png`);
  const { width, height } = DEVICE_SPECS[device].screen; // inner screen area

  const resizedScreenshot = await sharp(screenshotBuffer)
    .resize(width, height, { fit: 'cover' })
    .toBuffer();

  return frame
    .composite([{ input: resizedScreenshot, left: DEVICE_SPECS[device].x, top: DEVICE_SPECS[device].y }])
    .png()
    .toBuffer();
}
```

**Pros**: Zero external dependencies, fast, works in serverless, full control
**Cons**: Need to source/create frame PNGs (but many free ones available)

### Approach B: Mockuuups Studio API

- REST API: Upload screenshot → get device mockup back
- 5000+ device templates
- ~$15/mo
- Overkill for our needs

### Approach C: Just Pass Raw Screenshot to Gemini

Skip the device frame entirely. Just pass the screenshot with a smarter prompt:

```
"Show this exact app interface on a smartphone screen held by a person.
The phone screen must display this exact interface - do not modify or
replace it with generic graphics."
```

**Pros**: Simplest approach, no compositing needed
**Cons**: Gemini might still "reimagine" the screenshot rather than preserving it faithfully

### Recommendation: **Approach A (Sharp compositing) + Approach C (raw to Gemini) as fallback**

Use Sharp to create a device mockup for the reference image. This gives Gemini the clearest possible signal: "this is a phone showing THIS app." If we detect the generated output doesn't preserve the screenshot well, fall back to using the raw screenshot.

---

## Integration Plan for MarketPilot

### Phase 1: Screenshot Capture Service (New Module)

Create `src/lib/screenshots/capture.ts`:

```typescript
export async function captureWebsiteScreenshot(
  url: string,
  viewport: { width: number; height: number } = { width: 390, height: 844 }
): Promise<{ base64: string; mimeType: string } | null> {
  // 1. Call screenshot API
  // 2. Convert to base64
  // 3. Cache in Supabase Storage (avoid re-capturing same URL repeatedly)
  // 4. Return base64 + mimeType
}
```

### Phase 2: Device Mockup Compositor

Create `src/lib/screenshots/mockup.ts`:

```typescript
export async function createDeviceMockup(
  screenshotBase64: string,
  device: 'iphone_15' | 'macbook_pro' | 'ipad_pro'
): Promise<{ base64: string; mimeType: string }> {
  // Sharp composite screenshot into device frame PNG
}
```

### Phase 3: Pipeline Integration

#### Creative Designer (`route.ts`)
```diff
// When no reference image provided by user:
+ if (!referenceImage?.base64 && projectUrl) {
+   const screenshot = await captureWebsiteScreenshot(projectUrl);
+   if (screenshot) {
+     const mockup = await createDeviceMockup(screenshot.base64, 'iphone_15');
+     referenceImage = { base64: mockup.base64, mimeType: 'image/png' };
+   }
+ }
```

#### Video Creator (`script-generator.ts`)
Add screenshot context to scene prompts:
```diff
+ // If project has a URL, capture and include in scene descriptions
+ if (brandContext.websiteUrl) {
+   scenePrompt += "\nShow the actual app interface as seen in the reference image.";
+ }
```

#### Video Scene Pipeline (`scene-pipeline.ts`)
Pass the mockup screenshot as the initial reference image for scenes that mention the app:
```diff
+ if (scene.prompt.includes('app') || scene.prompt.includes('screen')) {
+   referenceImageBase64 = projectScreenshot.base64;
+ }
```

### Phase 4: Caching Layer

- Cache screenshots in **Supabase Storage** bucket `screenshots/`
- Key: `{projectId}/{urlHash}.png`
- TTL: 7 days (websites change, screenshots should refresh)
- Check cache before capturing → avoids redundant API calls

---

## Cost Analysis

| Component | Cost/month (est.) |
|-----------|-------------------|
| Screenshot API (apiflash, 100 free) | $0-9/mo |
| Supabase Storage (cached screenshots) | ~$0 (within free tier) |
| Sharp compositing | $0 (runs in existing serverless) |
| Device frame PNGs | $0 (one-time, free sources) |
| **Total** | **$0-9/mo** |

For comparison: the current video pipeline already costs ~$3/video for Veo + Remotion Lambda.

---

## Alternative: Browser-Based Approach (Your Suggestion)

You mentioned using DevTools/resize to capture mobile view — this is exactly what the screenshot APIs do under the hood. The API approach is better because:

1. **No browser needed**: API call from serverless function, no Chromium binary
2. **Custom viewport**: `width=390&height=844` gives you iPhone-sized capture
3. **Handles SPAs**: APIs wait for page load, handle JavaScript rendering
4. **Handles auth walls**: Some APIs support cookie injection if needed

But if you want zero external dependencies, you could:
- Use Vercel's `@vercel/og` runtime (has Satori, not full Chrome) — limited to HTML rendering
- Use a Supabase Edge Function with Deno + Puppeteer (experimental)
- Use a cheap Cloud Run instance with Puppeteer (most reliable self-hosted option)

---

## Free Device Frame Sources

- **Facebook Design Resources**: Free device mockup PNGs
- **Figma Community**: Search "device mockup" — hundreds of free frames
- **MockupWorld**: Free PNG device frames
- **Apple Design Resources**: Official iPhone/Mac frames (for Apple-specific mockups)

We only need 3 frames: iPhone (portrait), MacBook (landscape), Generic browser window.

---

## Key Takeaways

1. **The infrastructure already exists** — Creative Designer's reference image pipeline just needs an auto-screenshot feeding into it
2. **Screenshot API is the lightest integration** — one HTTP call, no new infra
3. **Sharp compositing for device frames** — we already use Sharp, just add device frame PNGs
4. **Cache aggressively** — screenshot once per week per project URL, not per asset
5. **Smart prompt engineering** — tell Gemini/Veo explicitly to preserve the exact app interface from the reference image
6. **Cost: $0-9/month** — negligible compared to existing AI costs

---

## Sources
1. [5 Free Screenshot APIs for Developers (2026)](https://dev.to/robocular/5-free-screenshot-apis-for-developers-in-2026-compared-438n) — API comparison with pricing
2. [Best Screenshot API Comparison (2026)](https://renderscreenshot.com/blog/best-screenshot-api-comparison) — Deep technical comparison
3. [Mockuuups Studio API](https://mockuuups.studio/api/) — Programmatic device mockup API
4. [Aibrify Device Mockup Generator](https://aibrify.com/tools/device-mockup) — Client-side Canvas-based mockups
5. [DeviceFrames.com](https://deviceframes.com/) — 3D device frame generator
6. [capture.page](https://capture.page/) — Screenshot as a service
7. [Best Screenshot APIs (OneSimpleApi)](https://onesimpleapi.com/best/screenshot-apis) — 15+ API comparison
