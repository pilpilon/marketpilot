import type { BrandTokens, PlatformDimensions } from "@/types/templates";
import React from "react";
import { detectDirection } from "./utils";

export function CenteredOverlay(
  fields: Record<string, string>,
  brand: BrandTokens,
  dims: PlatformDimensions
): React.ReactElement {
  const dir = detectDirection(fields);
  const headline = fields.headline || "";
  const subheadline = fields.subheadline || "";
  const headlineFontSize = Math.round(dims.width * 0.06);
  const subFontSize = Math.round(dims.width * 0.032);

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
          width: dims.width * 0.85,
          direction: dir,
          textAlign: "center",
        }}
      >
        {headline && (
          <div style={{ color: brand.textColor, fontSize: headlineFontSize, fontWeight: 700, fontFamily: "Inter, Heebo", whiteSpace: "normal", lineHeight: 1.2, direction: dir, textAlign: "center" }}>
            {headline}
          </div>
        )}
        {subheadline && (
          <div style={{ color: brand.textColor, fontSize: subFontSize, fontWeight: 400, fontFamily: "Inter, Heebo", whiteSpace: "normal", lineHeight: 1.4, opacity: 0.9, direction: dir, textAlign: "center" }}>
            {subheadline}
          </div>
        )}
      </div>
    </div>
  );
}
