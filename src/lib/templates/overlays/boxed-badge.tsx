import type { BrandTokens, PlatformDimensions } from "@/types/templates";
import React from "react";
import { detectDirection } from "./utils";

export function BoxedBadgeOverlay(
  fields: Record<string, string>,
  brand: BrandTokens,
  dims: PlatformDimensions
): React.ReactElement {
  const dir = detectDirection(fields);
  const headline = fields.headline || "";
  const subheadline = fields.subheadline || "";
  const attribution = fields.attribution || "";
  const headlineFontSize = Math.round(dims.width * 0.045);
  const subFontSize = Math.round(dims.width * 0.028);
  const attrFontSize = Math.round(dims.width * 0.025);

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
        alignItems: "center",
        justifyContent: "center",
        padding: `${dims.safeZone.top}px ${dims.safeZone.right}px ${dims.safeZone.bottom}px ${dims.safeZone.left}px`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: Math.round(dims.height * 0.015),
          backgroundColor: "#ffffff",
          borderRadius: 20,
          padding: `${Math.round(dims.height * 0.045)}px ${Math.round(dims.width * 0.07)}px`,
          maxWidth: dims.width * 0.8,
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          ...textStyle,
        }}
      >
        <div style={{ color: brand.accentColor, fontSize: Math.round(dims.width * 0.08), fontWeight: 800, fontFamily: "serif", lineHeight: 0.8 }}>
          {"\u201C"}
        </div>
        {headline && (
          <div style={{ color: "#1a1a2e", fontSize: headlineFontSize, fontWeight: 500, fontFamily: "Inter, Heebo", lineHeight: 1.5, fontStyle: "italic" }}>
            {headline}
          </div>
        )}
        {subheadline && (
          <div style={{ color: "#555", fontSize: subFontSize, fontWeight: 400, fontFamily: "Inter, Heebo", lineHeight: 1.4 }}>
            {subheadline}
          </div>
        )}
        {attribution && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexDirection: dir === "rtl" ? "row-reverse" : "row",
              gap: Math.round(dims.width * 0.02),
              marginTop: Math.round(dims.height * 0.01),
            }}
          >
            <div style={{ width: 40, height: 2, backgroundColor: brand.accentColor }} />
            <div style={{ color: brand.primaryColor, fontSize: attrFontSize, fontWeight: 600, fontFamily: "Inter, Heebo" }}>
              {attribution}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
