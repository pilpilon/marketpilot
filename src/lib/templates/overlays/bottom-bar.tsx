import type { BrandTokens, PlatformDimensions } from "@/types/templates";
import React from "react";
import { detectDirection, RtlTextBlock, toVisualRtl, scaleFontSize } from "./utils";

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
  const availableWidth = dims.width - pad * 2;
  const headlineFontSize = scaleFontSize(Math.round(dims.width * 0.042), headline, availableWidth, 2);
  const subFontSize = scaleFontSize(Math.round(dims.width * 0.024), subheadline, availableWidth, 2);
  const ctaFontSize = Math.round(dims.width * 0.028);
  const barHeight = Math.round(dims.height * 0.25);

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
    opacity: 0.9,
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
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: Math.round(dims.height * 0.012),
          backgroundColor: brand.primaryColor + "e6",
          overflow: "hidden",
          padding: `${Math.round(barHeight * 0.2)}px ${pad}px`,
          minHeight: barHeight,
          justifyContent: "center",
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
        {cta && (
          <div
            style={{
              display: "flex",
              marginTop: Math.round(dims.height * 0.01),
              justifyContent: dir === "rtl" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                color: brand.primaryColor,
                backgroundColor: "#ffffff",
                fontSize: ctaFontSize,
                fontWeight: 600,
                fontFamily: "Inter, Noto Sans Hebrew",
                padding: `${Math.round(dims.height * 0.01)}px ${Math.round(dims.width * 0.04)}px`,
                borderRadius: 8,
              }}
            >
              {dir === "rtl" ? toVisualRtl(cta) : cta}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
