import type { BrandTokens, PlatformDimensions } from "@/types/templates";
import React from "react";
import { detectDirection } from "./utils";

export function FullOverlay(
  fields: Record<string, string>,
  brand: BrandTokens,
  dims: PlatformDimensions
): React.ReactElement {
  const dir = detectDirection(fields);
  const headline = fields.headline || "";
  const subheadline = fields.subheadline || "";
  const cta = fields.cta || "";
  const headlineFontSize = Math.round(dims.width * 0.065);
  const subFontSize = Math.round(dims.width * 0.032);
  const ctaFontSize = Math.round(dims.width * 0.03);

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
        direction: dir,
        textAlign: "center",
      }}
    >
      {headline && (
        <div style={{ color: "#ffffff", fontSize: headlineFontSize, fontWeight: 800, fontFamily: "Inter, Heebo", whiteSpace: "normal", lineHeight: 1.15, letterSpacing: "-0.02em", direction: dir, textAlign: "center" }}>
          {headline}
        </div>
      )}
      {subheadline && (
        <div style={{ color: "#ffffff", fontSize: subFontSize, fontWeight: 400, fontFamily: "Inter, Heebo", whiteSpace: "normal", lineHeight: 1.5, opacity: 0.9, width: dims.width * 0.75, direction: dir, textAlign: "center" }}>
          {subheadline}
        </div>
      )}
      {cta && (
        <div style={{ marginTop: Math.round(dims.height * 0.015), textAlign: "center" }}>
          <div
            style={{
              display: "inline-block",
              color: brand.primaryColor,
              backgroundColor: "#ffffff",
              fontSize: ctaFontSize,
              fontWeight: 700,
              fontFamily: "Inter, Heebo",
              paddingTop: Math.round(dims.height * 0.015),
              paddingBottom: Math.round(dims.height * 0.015),
              paddingLeft: Math.round(dims.width * 0.06),
              paddingRight: Math.round(dims.width * 0.06),
              borderRadius: 12,
            }}
          >
            {cta}
          </div>
        </div>
      )}
    </div>
  );
}
