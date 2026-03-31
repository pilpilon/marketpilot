import type { BrandTokens, PlatformDimensions } from "@/types/templates";
import React from "react";
import { detectDirection, RtlTextBlock, toVisualRtl } from "./utils";

export function SplitLayoutOverlay(
  fields: Record<string, string>,
  brand: BrandTokens,
  dims: PlatformDimensions
): React.ReactElement {
  const dir = detectDirection(fields);
  const headline = fields.headline || "";
  const subheadline = fields.subheadline || "";
  const cta = fields.cta || "";
  const headlineFontSize = Math.round(dims.width * 0.055);
  const subFontSize = Math.round(dims.width * 0.03);
  const ctaFontSize = Math.round(dims.width * 0.026);
  const splitWidth = Math.round(dims.width * 0.45);

  const headlineStyle: React.CSSProperties = {
    color: "#ffffff",
    fontSize: headlineFontSize,
    fontWeight: 700,
    fontFamily: "Inter, Noto Sans Hebrew",
    lineHeight: 1.2,
    textAlign: dir === "rtl" ? "right" : "left",
  };

  const subStyle: React.CSSProperties = {
    color: "#ffffff",
    fontSize: subFontSize,
    fontWeight: 400,
    fontFamily: "Inter, Noto Sans Hebrew",
    lineHeight: 1.5,
    opacity: 0.9,
    textAlign: dir === "rtl" ? "right" : "left",
  };

  return (
    <div
      style={{
        width: dims.width,
        height: dims.height,
        display: "flex",
        flexDirection: dir === "rtl" ? "row-reverse" : "row",
      }}
    >
      {/* Transparent half (shows background image) */}
      <div style={{ flex: 1 }} />
      {/* Solid color half with text */}
      <div
        style={{
          width: splitWidth,
          height: dims.height,
          backgroundColor: brand.primaryColor + "f2",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: `${dims.safeZone.top}px ${Math.round(dims.width * 0.05)}px ${dims.safeZone.bottom}px ${Math.round(dims.width * 0.04)}px`,
          gap: Math.round(dims.height * 0.02),
        }}
      >
        {headline && (
          dir === "rtl"
            ? <RtlTextBlock text={headline} style={headlineStyle} />
            : <div style={headlineStyle}>{headline}</div>
        )}
        {subheadline && (
          dir === "rtl"
            ? <RtlTextBlock text={subheadline} style={subStyle} />
            : <div style={subStyle}>{subheadline}</div>
        )}
        {cta && (
          <div style={{ display: "flex", marginTop: Math.round(dims.height * 0.01), justifyContent: dir === "rtl" ? "flex-end" : "flex-start" }}>
            <div
              style={{
                color: brand.primaryColor,
                backgroundColor: "#ffffff",
                fontSize: ctaFontSize,
                fontWeight: 600,
                fontFamily: "Inter, Noto Sans Hebrew",
                padding: `${Math.round(dims.height * 0.01)}px ${Math.round(dims.width * 0.035)}px`,
                borderRadius: 8,
              }}
            >
              {dir === "rtl" ? toVisualRtl(cta) : cta}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
