import type { BrandTokens, PlatformDimensions } from "@/types/templates";
import React from "react";
import { detectDirection, RtlTextBlock, toVisualRtl } from "./utils";

export function FullOverlay(
  fields: Record<string, string>,
  brand: BrandTokens,
  dims: PlatformDimensions
): React.ReactElement {
  const dir = detectDirection(fields);
  const headline = fields.headline || "";
  const subheadline = fields.subheadline || "";
  const cta = fields.cta || "";
  const headlineFontSize = Math.round(dims.width * 0.075);
  const subFontSize = Math.round(dims.width * 0.035);
  const ctaFontSize = Math.round(dims.width * 0.03);

  const headlineStyle: React.CSSProperties = {
    color: "#ffffff",
    fontSize: headlineFontSize,
    fontWeight: 800,
    fontFamily: "Inter, Noto Sans Hebrew",
    textAlign: "center",
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
  };

  const subStyle: React.CSSProperties = {
    color: "#ffffff",
    fontSize: subFontSize,
    fontWeight: 400,
    fontFamily: "Inter, Noto Sans Hebrew",
    textAlign: "center",
    lineHeight: 1.5,
    opacity: 0.9,
    maxWidth: dims.width * 0.75,
  };

  return (
    <div
      style={{
        width: dims.width,
        height: dims.height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: brand.primaryColor + "cc",
        padding: `${dims.safeZone.top}px ${dims.safeZone.right + 40}px ${dims.safeZone.bottom}px ${dims.safeZone.left + 40}px`,
        gap: Math.round(dims.height * 0.025),
      }}
    >
      {headline && (
        dir === "rtl"
          ? <RtlTextBlock text={headline} style={{ ...headlineStyle, justifyContent: "center" }} />
          : <div style={headlineStyle}>{headline}</div>
      )}
      {subheadline && (
        dir === "rtl"
          ? <RtlTextBlock text={subheadline} style={{ ...subStyle, justifyContent: "center" }} />
          : <div style={subStyle}>{subheadline}</div>
      )}
      {cta && (
        <div style={{ display: "flex", marginTop: Math.round(dims.height * 0.015) }}>
          <div
            style={{
              color: brand.primaryColor,
              backgroundColor: "#ffffff",
              fontSize: ctaFontSize,
              fontWeight: 700,
              fontFamily: "Inter, Noto Sans Hebrew",
              padding: `${Math.round(dims.height * 0.015)}px ${Math.round(dims.width * 0.06)}px`,
              borderRadius: 12,
            }}
          >
            {dir === "rtl" ? toVisualRtl(cta) : cta}
          </div>
        </div>
      )}
    </div>
  );
}
