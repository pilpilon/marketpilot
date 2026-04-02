import type { BrandTokens, PlatformDimensions } from "@/types/templates";
import React from "react";
import { detectDirection, RtlTextBlock, scaleFontSize } from "./utils";

export function GradientOverlay(
  fields: Record<string, string>,
  brand: BrandTokens,
  dims: PlatformDimensions
): React.ReactElement {
  const dir = detectDirection(fields);
  const headline = fields.headline || "";
  const subheadline = fields.subheadline || "";
  const pad = Math.round(dims.width * 0.06);
  const availableWidth = dims.width - pad * 2;
  const headlineFontSize = scaleFontSize(Math.round(dims.width * 0.055), headline, availableWidth, 3);
  const subFontSize = scaleFontSize(Math.round(dims.width * 0.03), subheadline, availableWidth, 3);

  const headlineStyle: React.CSSProperties = {
    color: "#ffffff",
    fontSize: headlineFontSize,
    fontWeight: 700,
    fontFamily: "Inter, Noto Sans Hebrew",
    lineHeight: 1.2,
    textAlign: dir === "rtl" ? "right" : "left",
    wordBreak: "break-word",
  };

  const subStyle: React.CSSProperties = {
    color: "#ffffff",
    fontSize: subFontSize,
    fontWeight: 400,
    fontFamily: "Inter, Noto Sans Hebrew",
    lineHeight: 1.4,
    opacity: 0.85,
    textAlign: dir === "rtl" ? "right" : "left",
    wordBreak: "break-word",
  };

  return (
    <div
      style={{
        width: dims.width,
        height: dims.height,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        backgroundImage: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, transparent 70%)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: Math.round(dims.height * 0.015),
          padding: `${Math.round(dims.height * 0.05)}px ${Math.round(dims.width * 0.06)}px ${dims.safeZone.bottom + Math.round(dims.height * 0.03)}px`,
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
      </div>
    </div>
  );
}
