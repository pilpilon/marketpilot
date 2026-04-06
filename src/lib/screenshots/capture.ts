/**
 * Website screenshot capture — uses local headless Chromium by default (zero
 * external dependencies). Falls back to Browserless.io or ScreenshotOne if
 * the respective API key is set.
 *
 * The local approach uses puppeteer-core + @sparticuz/chromium-min which
 * downloads a minimal Chromium binary at runtime (~45 MB from a CDN).
 * This works inside Vercel serverless functions (250 MB limit).
 *
 * Screenshots are captured once during project setup and cached in Supabase
 * Storage — this is NOT on a hot path.
 */

import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium-min";

export interface ViewportSpec {
  width: number;
  height: number;
  deviceScaleFactor?: number;
}

export const VIEWPORTS: Record<"desktop" | "mobile", ViewportSpec> = {
  desktop: { width: 1280, height: 800, deviceScaleFactor: 2 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2 },
};

export interface CaptureResult {
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: "image/png";
}

/**
 * Chromium binary URL — @sparticuz/chromium-min fetches a pre-built binary
 * from this CDN URL at cold start. Pin to the version matching the installed
 * @sparticuz/chromium-min package.
 */
const CHROMIUM_PACK_URL =
  "https://github.com/nichochar/chromium-min-pack/releases/download/v133.0.0/chromium-v133.0.0-pack.tar";

/**
 * Capture a screenshot of the given URL at the specified viewport.
 *
 * Priority: local Puppeteer → Browserless API → ScreenshotOne API
 */
export async function captureScreenshot(
  url: string,
  viewport: "desktop" | "mobile" = "mobile"
): Promise<CaptureResult> {
  const spec = VIEWPORTS[viewport];

  // Priority 1: Browserless if key is set (simpler, no binary download)
  const browserlessKey = process.env.BROWSERLESS_API_KEY;
  if (browserlessKey) {
    return captureViaBrowserless(url, spec, browserlessKey);
  }

  // Priority 2: ScreenshotOne if key is set
  const screenshotOneKey = process.env.SCREENSHOTONE_API_KEY;
  if (screenshotOneKey) {
    return captureViaScreenshotOne(url, spec, screenshotOneKey);
  }

  // Priority 3: Local Puppeteer (default — zero config)
  return captureViaPuppeteer(url, spec);
}

/* ─── Local Puppeteer ─────────────────────────────────────────────── */

async function captureViaPuppeteer(
  url: string,
  spec: ViewportSpec
): Promise<CaptureResult> {
  const executablePath = await chromium.executablePath(CHROMIUM_PACK_URL);

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: {
      width: spec.width,
      height: spec.height,
      deviceScaleFactor: spec.deviceScaleFactor ?? 2,
    },
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();

    // Block heavy resources to speed up capture
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const type = req.resourceType();
      if (["font", "media"].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 8_000,
    });

    // Brief settle time for animations / lazy-loaded content
    await new Promise((r) => setTimeout(r, 1_000));

    const screenshotBuffer = await page.screenshot({ type: "png" });
    const buffer = Buffer.from(screenshotBuffer);

    return {
      buffer,
      width: spec.width * (spec.deviceScaleFactor ?? 2),
      height: spec.height * (spec.deviceScaleFactor ?? 2),
      mimeType: "image/png",
    };
  } finally {
    await browser.close();
  }
}

/* ─── Browserless REST API ────────────────────────────────────────── */

async function captureViaBrowserless(
  url: string,
  spec: ViewportSpec,
  token: string
): Promise<CaptureResult> {
  const endpoint = `https://chrome.browserless.io/screenshot?token=${token}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      options: { type: "png", fullPage: false },
      viewport: {
        width: spec.width,
        height: spec.height,
        deviceScaleFactor: spec.deviceScaleFactor ?? 2,
      },
      waitForTimeout: 3000,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Browserless screenshot failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());

  return {
    buffer,
    width: spec.width * (spec.deviceScaleFactor ?? 2),
    height: spec.height * (spec.deviceScaleFactor ?? 2),
    mimeType: "image/png",
  };
}

/* ─── ScreenshotOne REST API ──────────────────────────────────────── */

async function captureViaScreenshotOne(
  url: string,
  spec: ViewportSpec,
  accessKey: string
): Promise<CaptureResult> {
  const params = new URLSearchParams({
    access_key: accessKey,
    url,
    viewport_width: String(spec.width),
    viewport_height: String(spec.height),
    device_scale_factor: String(spec.deviceScaleFactor ?? 2),
    format: "png",
    block_cookie_banners: "true",
    block_ads: "true",
  });

  const res = await fetch(`https://api.screenshotone.com/take?${params}`, {
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ScreenshotOne capture failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());

  return {
    buffer,
    width: spec.width * (spec.deviceScaleFactor ?? 2),
    height: spec.height * (spec.deviceScaleFactor ?? 2),
    mimeType: "image/png",
  };
}
