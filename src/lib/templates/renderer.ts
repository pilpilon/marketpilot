import { Renderer } from "@takumi-rs/core";
import { fromJsx } from "@takumi-rs/helpers/jsx";
import type { BrandTokens, PlatformDimensions, OverlayStyle } from "@/types/templates";
import { getOverlayRenderer } from "./overlay-registry";

// ─── Font Loading (cached at module scope — loaded once per cold start) ──────

type FontEntry = { name: string; data: ArrayBuffer; weight: 400 | 700 | 800; style: "normal" };

let fontsPromise: Promise<FontEntry[]> | null = null;

async function loadFonts(): Promise<FontEntry[]> {
  if (fontsPromise) return fontsPromise;

  fontsPromise = (async () => {
    const interRegularUrl = "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf";
    const interBoldUrl = "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf";
    const heeboRegularUrl = "https://fonts.gstatic.com/s/heebo/v28/NGSpv5_NC0k9P_v6ZUCbLRAHxK1EiSysd0mj.ttf";
    const heeboBoldUrl = "https://fonts.gstatic.com/s/heebo/v28/NGSpv5_NC0k9P_v6ZUCbLRAHxK1Ebiusd0mj.ttf";
    const heeboExtraBoldUrl = "https://fonts.gstatic.com/s/heebo/v28/NGSpv5_NC0k9P_v6ZUCbLRAHxK1ECSusd0mj.ttf";

    const [interRegular, interBold, hebrewRegular, hebrewBold, hebrewExtraBold] = await Promise.all([
      fetch(interRegularUrl).then((r) => r.arrayBuffer()),
      fetch(interBoldUrl).then((r) => r.arrayBuffer()),
      fetch(heeboRegularUrl).then((r) => r.arrayBuffer()),
      fetch(heeboBoldUrl).then((r) => r.arrayBuffer()),
      fetch(heeboExtraBoldUrl).then((r) => r.arrayBuffer()),
    ]);

    return [
      { name: "Inter", data: interRegular, weight: 400 as const, style: "normal" as const },
      { name: "Inter", data: interBold, weight: 700 as const, style: "normal" as const },
      { name: "Heebo", data: hebrewRegular, weight: 400 as const, style: "normal" as const },
      { name: "Heebo", data: hebrewBold, weight: 700 as const, style: "normal" as const },
      { name: "Heebo", data: hebrewExtraBold, weight: 800 as const, style: "normal" as const },
    ];
  })();

  return fontsPromise;
}

// ─── Renderer (cached at module scope) ──────────────────────────────────────

let rendererPromise: Promise<Renderer> | null = null;

async function getRenderer(): Promise<Renderer> {
  if (rendererPromise) return rendererPromise;

  rendererPromise = (async () => {
    const fonts = await loadFonts();
    const renderer = new Renderer({
      fonts: fonts.map((f) => ({
        name: f.name,
        data: f.data,
        weight: f.weight,
        style: f.style,
      })),
      loadDefaultFonts: false,
    });
    return renderer;
  })();

  return rendererPromise;
}

// ─── Render Overlay to PNG ───────────────────────────────────────────────────

/**
 * Renders a text overlay to a transparent PNG buffer.
 *
 * 1. Calls the overlay renderer function → React JSX element
 * 2. fromJsx converts React element → Takumi Node tree
 * 3. Takumi renders Node tree → PNG buffer directly (no SVG intermediate)
 */
export async function renderOverlayToPng(
  overlayStyle: OverlayStyle,
  fields: Record<string, string>,
  brand: BrandTokens,
  dims: PlatformDimensions
): Promise<Buffer> {
  const overlayFn = getOverlayRenderer(overlayStyle);
  const element = overlayFn(fields, brand, dims);

  const renderer = await getRenderer();
  const { node, stylesheets } = await fromJsx(element);

  const pngBuffer = await renderer.render(node, {
    width: dims.width,
    height: dims.height,
    format: "png",
    stylesheets,
  });

  return Buffer.from(pngBuffer);
}
