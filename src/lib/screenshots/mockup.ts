/**
 * Device mockup compositor — places a screenshot inside a device frame PNG
 * using Sharp. The result is a single image ready to use as a Gemini/Veo
 * reference image.
 *
 * Device frames are stored in public/mockups/ as transparent PNGs.
 * Screen area coordinates define where the screenshot is composited.
 */

import sharp from "sharp";
import path from "path";

export type DeviceType = "iphone" | "browser";

interface DeviceSpec {
  /** Frame PNG filename in public/mockups/ */
  frame: string;
  /** Screen area inside the frame (in frame-image pixels) */
  screen: { x: number; y: number; width: number; height: number };
  /** Full frame dimensions */
  frameSize: { width: number; height: number };
}

/**
 * Device specs — coordinates measured from the frame PNGs.
 * These use simple programmatically-generated frames (see generateFrames).
 */
const DEVICE_SPECS: Record<DeviceType, DeviceSpec> = {
  iphone: {
    frame: "iphone-frame.png",
    screen: { x: 18, y: 18, width: 390, height: 844 },
    frameSize: { width: 426, height: 880 },
  },
  browser: {
    frame: "browser-frame.png",
    screen: { x: 2, y: 40, width: 1280, height: 800 },
    frameSize: { width: 1284, height: 842 },
  },
};

/**
 * Generate simple device frame PNGs programmatically using Sharp.
 * Called once at startup / build time to ensure frames exist.
 */
export async function ensureDeviceFrames(): Promise<void> {
  const mockupsDir = path.join(process.cwd(), "public", "mockups");

  // iPhone-style frame: dark rounded rectangle border
  const iphoneSpec = DEVICE_SPECS.iphone;
  const iphoneSvg = `<svg width="${iphoneSpec.frameSize.width}" height="${iphoneSpec.frameSize.height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${iphoneSpec.frameSize.width}" height="${iphoneSpec.frameSize.height}" rx="36" ry="36" fill="#1a1a1a"/>
    <rect x="${iphoneSpec.screen.x}" y="${iphoneSpec.screen.y}" width="${iphoneSpec.screen.width}" height="${iphoneSpec.screen.height}" rx="4" ry="4" fill="black"/>
    <rect x="${iphoneSpec.frameSize.width / 2 - 40}" y="6" width="80" height="6" rx="3" ry="3" fill="#333"/>
  </svg>`;

  await sharp(Buffer.from(iphoneSvg))
    .png()
    .toFile(path.join(mockupsDir, "iphone-frame.png"));

  // Browser-style frame: light gray title bar with dots
  const browserSpec = DEVICE_SPECS.browser;
  const browserSvg = `<svg width="${browserSpec.frameSize.width}" height="${browserSpec.frameSize.height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${browserSpec.frameSize.width}" height="${browserSpec.frameSize.height}" rx="8" ry="8" fill="#e5e5e5"/>
    <rect x="0" y="0" width="${browserSpec.frameSize.width}" height="40" rx="8" ry="0" fill="#e5e5e5"/>
    <circle cx="20" cy="20" r="6" fill="#ff5f57"/>
    <circle cx="40" cy="20" r="6" fill="#febc2e"/>
    <circle cx="60" cy="20" r="6" fill="#28c840"/>
    <rect x="80" y="10" width="${browserSpec.frameSize.width - 100}" height="20" rx="4" ry="4" fill="#ffffff"/>
    <rect x="${browserSpec.screen.x}" y="${browserSpec.screen.y}" width="${browserSpec.screen.width}" height="${browserSpec.screen.height}" fill="black"/>
  </svg>`;

  await sharp(Buffer.from(browserSvg))
    .png()
    .toFile(path.join(mockupsDir, "browser-frame.png"));
}

/**
 * Composite a screenshot into a device frame.
 *
 * @returns PNG buffer of the mockup image
 */
export async function createDeviceMockup(
  screenshotBuffer: Buffer,
  device: DeviceType = "iphone"
): Promise<{ buffer: Buffer; mimeType: "image/png" }> {
  const spec = DEVICE_SPECS[device];
  const framePath = path.join(process.cwd(), "public", "mockups", spec.frame);

  // Resize screenshot to fit the screen area
  const resizedScreenshot = await sharp(screenshotBuffer)
    .resize(spec.screen.width, spec.screen.height, { fit: "cover", position: "top" })
    .png()
    .toBuffer();

  // Load frame and composite screenshot underneath, then frame on top
  const result = await sharp({
    create: {
      width: spec.frameSize.width,
      height: spec.frameSize.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      // Screenshot placed at screen coordinates
      { input: resizedScreenshot, top: spec.screen.y, left: spec.screen.x },
      // Frame on top (its transparent center reveals screenshot)
      { input: framePath, top: 0, left: 0 },
    ])
    .png()
    .toBuffer();

  return { buffer: result, mimeType: "image/png" };
}

/**
 * Convert a screenshot buffer to a base64 reference image payload
 * suitable for the creative-designer / veo-client reference image params.
 */
export async function screenshotToReferenceImage(
  screenshotBuffer: Buffer,
  device: DeviceType = "iphone"
): Promise<{ base64: string; mimeType: string }> {
  const mockup = await createDeviceMockup(screenshotBuffer, device);
  return {
    base64: mockup.buffer.toString("base64"),
    mimeType: "image/png",
  };
}
