import type { BrandTokens, PlatformDimensions } from "@/types/templates";
import React from "react";
import { detectDirection } from "./utils";

export function CornerOverlay(
  fields: Record<string, string>,
  brand: BrandTokens,
  dims: PlatformDimensions
): React.ReactElement {
  const dir = detectDirection(fields);
  const headline = fields.headline || "";
  const subheadline = fields.subheadline || "";
  const headlineFontSize = Math.round(dims.width * 0.05);
  const subFontSize = Math.round(dims.width * 0.028);
  const padX = Math.round(dims.width * 0.06);
  const padY = Math.round(dims.height * 0.04);

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
        alignItems: dir === "rtl" ? "flex-end" : "flex-start",
        padding: `${dims.safeZone.top}px ${dims.safeZone.right + padX}px ${dims.safeZone.bottom + padY}px ${dims.safeZone.left + padX}px`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: Math.round(dims.height * 0.008),
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          borderRadius: 12,
          padding: `${Math.round(dims.height * 0.02)}px ${Math.round(dims.width * 0.04)}px`,
          maxWidth: dims.width * 0.65,
          borderLeft: dir === "ltr" ? `4px solid ${brand.accentColor}` : "none",
          borderRight: dir === "rtl" ? `4px solid ${brand.accentColor}` : "none",
          ...textStyle,
        }}
      >
        {headline && (
          <div style={{ color: "#ffffff", fontSize: headlineFontSize, fontWeight: 700, fontFamily: "Inter, Heebo", lineHeight: 1.25 }}>
            {headline}
          </div>
        )}
        {subheadline && (
          <div style={{ color: "#ffffff", fontSize: subFontSize, fontWeight: 400, fontFamily: "Inter, Heebo", lineHeight: 1.4, opacity: 0.85 }}>
            {subheadline}
          </div>
        )}
      </div>
    </div>
  );
}
