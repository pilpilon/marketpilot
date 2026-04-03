import type { BrandTokens, PlatformDimensions } from "@/types/templates";
import React from "react";
import { detectDirection } from "./utils";

export function BottomBarOverlay(
  fields: Record<string, string>,
  brand: BrandTokens,
  dims: PlatformDimensions
): React.ReactElement {
  const dir = detectDirection(fields);
  const headline = fields.headline || "";
  const subheadline = fields.subheadline || "";
  const cta = fields.cta || "";
  const pad = Math.round(dims.width * 0.06);
  const headlineFontSize = Math.round(dims.width * 0.048);
  const subFontSize = Math.round(dims.width * 0.028);
  const ctaFontSize = Math.round(dims.width * 0.028);
  const barHeight = Math.round(dims.height * 0.25);

  const textStyle: React.CSSProperties = {
    direction: dir,
    textAlign: dir === "rtl" ? "right" : "left",
  };

  return (
    <div style={{ width: dims.width, height: dims.height, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: brand.primaryColor + "e6",
          overflow: "hidden",
          minHeight: barHeight,
          paddingTop: Math.round(barHeight * 0.2),
          paddingBottom: Math.round(barHeight * 0.2),
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: Math.round(dims.height * 0.012),
            width: dims.width - pad * 2,
            justifyContent: "center",
            ...textStyle,
          }}
        >
          {headline && (
            <div style={{ color: "#ffffff", fontSize: headlineFontSize, fontWeight: 700, fontFamily: "Inter, Noto Sans Hebrew", lineHeight: 1.2, whiteSpace: "normal" }}>
              {headline}
            </div>
          )}
          {subheadline && (
            <div style={{ color: "#ffffff", fontSize: subFontSize, fontWeight: 400, fontFamily: "Inter, Noto Sans Hebrew", lineHeight: 1.4, opacity: 0.9, whiteSpace: "normal" }}>
              {subheadline}
            </div>
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
                  paddingTop: Math.round(dims.height * 0.01),
                  paddingBottom: Math.round(dims.height * 0.01),
                  paddingLeft: Math.round(dims.width * 0.04),
                  paddingRight: Math.round(dims.width * 0.04),
                  borderRadius: 8,
                }}
              >
                {cta}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
