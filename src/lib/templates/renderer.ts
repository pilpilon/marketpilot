import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { BrandTokens, PlatformDimensions, OverlayStyle } from "@/types/templates";
import { getOverlayRenderer } from "./overlay-registry";

// ─── Font Loading (cached at module scope — loaded once per cold start) ──────

let fontsPromise: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[]> | null = null;

async function loadFonts() {
  if (fontsPromise) return fontsPromise;

  fontsPromise = (async () => {
    // Inter Latin subset
    const interRegularUrl = "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf";
    const interBoldUrl = "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf";

    // Noto Sans Hebrew — covers Hebrew characters that Inter Latin subset doesn't include
    const notoHebrewRegularUrl = "https://fonts.gstatic.com/s/notosanshebrew/v50/or3HQ7v33eiDljA1IufXTtVf7V6RvEEdhQlk0LlGxCyaeNKYZC0sqk3xXGiXd4qtog.ttf";
    const notoHebrewBoldUrl = "https://fonts.gstatic.com/s/notosanshebrew/v50/or3HQ7v33eiDljA1IufXTtVf7V6RvEEdhQlk0LlGxCyaeNKYZC0sqk3xXGiXkI2tog.ttf";

    const [interRegular, interBold, hebrewRegular, hebrewBold] = await Promise.all([
      fetch(interRegularUrl).then((r) => r.arrayBuffer()),
      fetch(interBoldUrl).then((r) => r.arrayBuffer()),
      fetch(notoHebrewRegularUrl).then((r) => r.arrayBuffer()),
      fetch(notoHebrewBoldUrl).then((r) => r.arrayBuffer()),
    ]);

    return [
      { name: "Inter", data: interRegular, weight: 400 as const, style: "normal" as const },
      { name: "Inter", data: interBold, weight: 700 as const, style: "normal" as const },
      // Noto Sans Hebrew as fallback — Satori uses these when Inter can't render a character
      { name: "Noto Sans Hebrew", data: hebrewRegular, weight: 400 as const, style: "normal" as const },
      { name: "Noto Sans Hebrew", data: hebrewBold, weight: 700 as const, style: "normal" as const },
    ];
  })();

  return fontsPromise;
}

// ─── Render Overlay to PNG ───────────────────────────────────────────────────

/**
 * Renders a text overlay to a transparent PNG buffer.
 *
 * 1. Calls the overlay renderer function → React JSX element
 * 2. Satori converts JSX → SVG
 * 3. resvg-js converts SVG → PNG
 */
export async function renderOverlayToPng(
  overlayStyle: OverlayStyle,
  fields: Record<string, string>,
  brand: BrandTokens,
  dims: PlatformDimensions
): Promise<Buffer> {
  const renderer = getOverlayRenderer(overlayStyle);
  const element = renderer(fields, brand, dims);
  const fonts = await loadFonts();

  const svg = await satori(element, {
    width: dims.width,
    height: dims.height,
    fonts: fonts.map((f) => ({
      name: f.name,
      data: f.data,
      weight: f.weight,
      style: f.style,
    })),
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: dims.width },
  });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}
