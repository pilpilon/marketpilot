import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { findLargestUsableFontSize } from "@altano/satori-fit-text";
import type { BrandTokens, PlatformDimensions, OverlayStyle, FittedSizes } from "@/types/templates";
import { getOverlayRenderer } from "./overlay-registry";

// ─── Font Loading (cached at module scope — loaded once per cold start) ──────

type FontEntry = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };

let fontsPromise: Promise<FontEntry[]> | null = null;

async function loadFonts(): Promise<FontEntry[]> {
  if (fontsPromise) return fontsPromise;

  fontsPromise = (async () => {
    const interRegularUrl = "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf";
    const interBoldUrl = "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf";
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
      { name: "Noto Sans Hebrew", data: hebrewRegular, weight: 400 as const, style: "normal" as const },
      { name: "Noto Sans Hebrew", data: hebrewBold, weight: 700 as const, style: "normal" as const },
    ];
  })();

  return fontsPromise;
}

// ─── Text Fitting ───────────────────────────────────────────────────────────

function pickFont(fonts: FontEntry[], text: string, weight: 400 | 700): FontEntry {
  const hasHebrew = /[\u0590-\u05FF]/.test(text);
  return fonts.find((f) => f.name === (hasHebrew ? "Noto Sans Hebrew" : "Inter") && f.weight === weight)!;
}

async function fitTextSize(
  text: string,
  maxWidth: number,
  maxHeight: number,
  maxFontSize: number,
  weight: 400 | 700,
  lineHeight: number
): Promise<number> {
  if (!text) return maxFontSize;
  const fonts = await loadFonts();
  const font = pickFont(fonts, text, weight);
  return findLargestUsableFontSize({
    text,
    font: { name: font.name, data: font.data, weight: font.weight },
    maxWidth,
    maxHeight,
    maxFontSize,
    minFontSize: 14,
    lineHeight,
  });
}

/** Available text width/height per overlay style */
function getTextArea(style: OverlayStyle, dims: PlatformDimensions): { width: number; headlineHeight: number; subHeight: number } {
  const pad = Math.round(dims.width * 0.06);
  switch (style) {
    case "split_layout": {
      const splitW = Math.round(dims.width * 0.50);
      const innerW = splitW - Math.round(dims.width * 0.03) * 2;
      return { width: innerW, headlineHeight: Math.round(dims.height * 0.25), subHeight: Math.round(dims.height * 0.20) };
    }
    case "bottom_bar": {
      const barH = Math.round(dims.height * 0.25);
      return { width: dims.width - pad * 2, headlineHeight: Math.round(barH * 0.45), subHeight: Math.round(barH * 0.35) };
    }
    case "gradient_overlay":
      return { width: dims.width - pad * 2, headlineHeight: Math.round(dims.height * 0.15), subHeight: Math.round(dims.height * 0.10) };
    case "centered":
      return { width: Math.round(dims.width * 0.75), headlineHeight: Math.round(dims.height * 0.20), subHeight: Math.round(dims.height * 0.15) };
    case "full_overlay":
      return { width: dims.width - pad * 2, headlineHeight: Math.round(dims.height * 0.20), subHeight: Math.round(dims.height * 0.15) };
    default:
      return { width: dims.width - pad * 2, headlineHeight: Math.round(dims.height * 0.20), subHeight: Math.round(dims.height * 0.15) };
  }
}

async function computeFittedSizes(
  overlayStyle: OverlayStyle,
  fields: Record<string, string>,
  dims: PlatformDimensions
): Promise<FittedSizes> {
  const area = getTextArea(overlayStyle, dims);
  const maxHeadline = Math.round(dims.width * 0.055);
  const maxSub = Math.round(dims.width * 0.032);

  const [headline, subheadline] = await Promise.all([
    fitTextSize(fields.headline || "", area.width, area.headlineHeight, maxHeadline, 700, 1.2),
    fitTextSize(fields.subheadline || "", area.width, area.subHeight, maxSub, 400, 1.5),
  ]);

  return { headline, subheadline };
}

// ─── Render Overlay to PNG ───────────────────────────────────────────────────

export async function renderOverlayToPng(
  overlayStyle: OverlayStyle,
  fields: Record<string, string>,
  brand: BrandTokens,
  dims: PlatformDimensions
): Promise<Buffer> {
  const renderer = getOverlayRenderer(overlayStyle);
  const fonts = await loadFonts();
  const fittedSizes = await computeFittedSizes(overlayStyle, fields, dims);
  const element = renderer(fields, brand, dims, fittedSizes);

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
