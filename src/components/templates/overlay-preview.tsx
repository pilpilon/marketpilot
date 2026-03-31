"use client";

import type { OverlayStyle } from "@/types/templates";

interface OverlayPreviewProps {
  overlayStyle: OverlayStyle;
  fields: Record<string, string>;
  primaryColor?: string;
  accentColor?: string;
  ratioClass: string;
}

function detectDir(fields: Record<string, string>): "rtl" | "ltr" {
  const text = Object.values(fields).join(" ");
  return /[\u0590-\u05FF\u0600-\u06FF]/.test(text) ? "rtl" : "ltr";
}

/**
 * Client-side CSS approximation of overlay layout.
 * NOT pixel-perfect — directional preview showing where text will appear.
 */
export function OverlayPreview({
  overlayStyle,
  fields,
  primaryColor = "#1a1a2e",
  accentColor = "#e94560",
  ratioClass,
}: OverlayPreviewProps) {
  const headline = fields.headline || "Your headline here";
  const subheadline = fields.subheadline || "";
  const cta = fields.cta || "";
  const attribution = fields.attribution || "";
  const dir = detectDir(fields);
  const textAlign = dir === "rtl" ? "right" : "left" as const;

  return (
    <div className={`${ratioClass} w-full max-w-sm mx-auto rounded-lg overflow-hidden border bg-muted relative`}>
      {/* Simulated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-300 to-gray-400" />

      {/* Overlay approximation */}
      {overlayStyle === "centered" && (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="bg-black/55 rounded-2xl px-6 py-5 text-center max-w-[85%]">
            <p className="text-white font-bold text-sm leading-tight">{headline}</p>
            {subheadline && (
              <p className="text-white/90 text-xs mt-1.5">{subheadline}</p>
            )}
          </div>
        </div>
      )}

      {overlayStyle === "bottom_bar" && (
        <div className="absolute inset-x-0 bottom-0 p-4" style={{ backgroundColor: primaryColor + "e6", direction: dir }}>
          <p className="text-white font-bold text-sm" style={{ textAlign }}>{headline}</p>
          {subheadline && <p className="text-white/90 text-xs mt-1" style={{ textAlign }}>{subheadline}</p>}
          {cta && (
            <div style={{ display: "flex", justifyContent: dir === "rtl" ? "flex-end" : "flex-start" }}>
              <span className="inline-block mt-2 bg-white text-xs font-semibold px-3 py-1 rounded" style={{ color: primaryColor }}>
                {cta}
              </span>
            </div>
          )}
        </div>
      )}

      {overlayStyle === "gradient_overlay" && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex flex-col justify-end p-5" style={{ direction: dir }}>
          <p className="text-white font-bold text-sm" style={{ textAlign }}>{headline}</p>
          {subheadline && <p className="text-white/85 text-xs mt-1" style={{ textAlign }}>{subheadline}</p>}
        </div>
      )}

      {overlayStyle === "full_overlay" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center" style={{ backgroundColor: primaryColor + "cc", direction: dir }}>
          <p className="text-white font-extrabold text-base uppercase tracking-tight">{headline}</p>
          {subheadline && <p className="text-white/90 text-xs mt-2 max-w-[75%]">{subheadline}</p>}
          {cta && (
            <span className="inline-block mt-3 bg-white text-xs font-bold px-4 py-1.5 rounded-lg" style={{ color: primaryColor }}>
              {cta}
            </span>
          )}
        </div>
      )}

      {overlayStyle === "split_layout" && (
        <div className="absolute inset-0 flex flex-row">
          <div className="flex-1" />
          <div className="w-[45%] flex flex-col justify-center p-4 gap-1.5" style={{ backgroundColor: primaryColor + "f2", direction: dir }}>
            <p className="text-white font-bold text-xs" style={{ textAlign }}>{headline}</p>
            {subheadline && <p className="text-white/90 text-[10px]" style={{ textAlign }}>{subheadline}</p>}
            {cta && (
              <div style={{ display: "flex", justifyContent: dir === "rtl" ? "flex-end" : "flex-start" }}>
                <span className="inline-block mt-1 bg-white text-[10px] font-semibold px-2 py-0.5 rounded w-fit" style={{ color: primaryColor }}>
                  {cta}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {overlayStyle === "boxed_badge" && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-5 shadow-lg max-w-[80%]" style={{ direction: dir }}>
            <span className="text-2xl font-bold" style={{ color: accentColor }}>{"\u201C"}</span>
            <p className="text-gray-900 text-xs font-medium italic mt-1" style={{ textAlign }}>{headline}</p>
            {subheadline && <p className="text-gray-500 text-[10px] mt-1.5" style={{ textAlign }}>{subheadline}</p>}
            {attribution && (
              <div className="flex items-center gap-2 mt-2" style={{ flexDirection: dir === "rtl" ? "row-reverse" : "row" }}>
                <div className="w-6 h-0.5" style={{ backgroundColor: accentColor }} />
                <span className="text-[10px] font-semibold" style={{ color: primaryColor }}>{attribution}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {overlayStyle === "corner" && (
        <div
          className="absolute inset-0 flex flex-col justify-end p-5"
          style={{ alignItems: dir === "rtl" ? "flex-end" : "flex-start" }}
        >
          <div
            className="bg-black/60 rounded-xl px-4 py-3 max-w-[65%]"
            style={{
              borderLeft: dir === "ltr" ? `3px solid ${accentColor}` : "none",
              borderRight: dir === "rtl" ? `3px solid ${accentColor}` : "none",
              direction: dir,
            }}
          >
            <p className="text-white font-bold text-xs" style={{ textAlign }}>{headline}</p>
            {subheadline && <p className="text-white/85 text-[10px] mt-0.5" style={{ textAlign }}>{subheadline}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
