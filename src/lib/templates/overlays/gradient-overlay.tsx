import type { BrandTokens, PlatformDimensions } from "@/types/templates";
import React from "react";
import { detectDirection } from "./utils";

export function GradientOverlay(
  fields: Record<string, string>,
  brand: BrandTokens,
  dims: PlatformDimensions
): React.ReactElement {
  const dir = detectDirection(fields);
  const headline = fields.headline || "";
  const subheadline = fields.subheadline || "";
  const headlineFontSize = Math.round(dims.width * 0.055);
  const subFontSize = Math.round(dims.width * 0.03);

  const textStyle: React.CSSProperties = {
    direction: dir,
    textAlign: dir === "rtl" ? "right" : "left",
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
          ...textStyle,
        }}
      >
        {headline && (
          <div style={{ color: "#ffffff", fontSize: headlineFontSize, fontWeight: 700, fontFamily: "Inter, Heebo", textAlign: dir === "rtl" ? "right" : "left", lineHeight: 1.2 }}>
            {headline}
          </div>
        )}
        {subheadline && (
          <div style={{ color: "#ffffff", fontSize: subFontSize, fontWeight: 400, fontFamily: "Inter, Heebo", textAlign: dir === "rtl" ? "right" : "left", lineHeight: 1.4, opacity: 0.85 }}>
            {subheadline}
          </div>
        )}
      </div>
    </div>
  );
}
