import type { BrandTokens, PlatformDimensions } from "@/types/templates";
import React from "react";
import { detectDirection, RtlTextBlock, scaleFontSize } from "./utils";

export function CenteredOverlay(
  fields: Record<string, string>,
  brand: BrandTokens,
  dims: PlatformDimensions
): React.ReactElement {
  const dir = detectDirection(fields);
  const headline = fields.headline || "";
  const subheadline = fields.subheadline || "";
  const availableWidth = dims.width * 0.75;
  const headlineFontSize = scaleFontSize(Math.round(dims.width * 0.06), headline, availableWidth, 3);
  const subFontSize = scaleFontSize(Math.round(dims.width * 0.032), subheadline, availableWidth, 3);

  const headlineStyle: React.CSSProperties = {
    color: brand.textColor,
    fontSize: headlineFontSize,
    fontWeight: 700,
    fontFamily: "Inter, Noto Sans Hebrew",
    textAlign: "center",
    lineHeight: 1.2,
  };

  const subStyle: React.CSSProperties = {
    color: brand.textColor,
    fontSize: subFontSize,
    fontWeight: 400,
    fontFamily: "Inter, Noto Sans Hebrew",
    textAlign: "center",
    lineHeight: 1.4,
    opacity: 0.9,
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
        padding: `${dims.safeZone.top}px ${dims.safeZone.right}px ${dims.safeZone.bottom}px ${dims.safeZone.left}px`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: Math.round(dims.height * 0.02),
          backgroundColor: "rgba(0, 0, 0, 0.55)",
          borderRadius: 16,
          padding: `${Math.round(dims.height * 0.04)}px ${Math.round(dims.width * 0.08)}px`,
          maxWidth: dims.width * 0.85,
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
      </div>
    </div>
  );
}
