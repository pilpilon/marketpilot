import type { BrandTokens, PlatformDimensions } from "@/types/templates";
import React from "react";
import { detectDirection } from "./utils";

export function SplitLayoutOverlay(
  fields: Record<string, string>,
  brand: BrandTokens,
  dims: PlatformDimensions
): React.ReactElement {
  const dir = detectDirection(fields);
  const headline = fields.headline || "";
  const subheadline = fields.subheadline || "";
  const cta = fields.cta || "";
  const splitWidth = Math.round(dims.width * 0.50);
  const pad = Math.round(dims.width * 0.04);
  const headlineFontSize = Math.round(dims.width * 0.046);
  const subFontSize = Math.round(dims.width * 0.025);
  const ctaFontSize = Math.round(dims.width * 0.026);

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
        flexDirection: dir === "rtl" ? "row" : "row-reverse",
      }}
    >
      <div style={{ flex: 1 }} />
      <div
        style={{
          width: splitWidth,
          height: dims.height,
          backgroundColor: brand.primaryColor + "f2",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: splitWidth - pad * 2,
            gap: Math.round(dims.height * 0.02),
          }}
        >
          {headline && (
            <div style={{ display: "flex", direction: dir }}>
              <div style={{ color: "#ffffff", fontSize: headlineFontSize, fontWeight: 700, fontFamily: "Inter, Heebo", lineHeight: 1.2, whiteSpace: "normal", ...textStyle }}>
                {headline}
              </div>
            </div>
          )}
          {subheadline && (
            <div style={{ display: "flex", direction: dir }}>
              <div style={{ color: "#ffffff", fontSize: subFontSize, fontWeight: 400, fontFamily: "Inter, Heebo", lineHeight: 1.5, opacity: 0.9, whiteSpace: "normal", ...textStyle }}>
                {subheadline}
              </div>
            </div>
          )}
          {cta && (
            <div style={{ display: "flex", marginTop: Math.round(dims.height * 0.01), direction: dir }}>
              <div
                style={{
                  color: brand.primaryColor,
                  backgroundColor: "#ffffff",
                  fontSize: ctaFontSize,
                  fontWeight: 600,
                  fontFamily: "Inter, Heebo",
                  paddingTop: Math.round(dims.height * 0.01),
                  paddingBottom: Math.round(dims.height * 0.01),
                  paddingLeft: Math.round(dims.width * 0.035),
                  paddingRight: Math.round(dims.width * 0.035),
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
