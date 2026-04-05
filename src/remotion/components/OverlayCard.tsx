import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

type Variant = "hook" | "lowerThird" | "cta";

interface OverlayCardProps {
  variant: Variant;
  text: string;
  language: "en" | "he";
  palette: {
    primary: string;
    accent: string;
    text: string;
  };
}

/**
 * Branded overlay card with RTL-aware Heebo rendering for Hebrew.
 *
 * Lessons from Takumi (see CLAUDE.md): Hebrew RTL requires explicit
 * direction="rtl" + textAlign="right" on the block element. No flex
 * wrappers around text that shrink to content width.
 */
export function OverlayCard({ variant, text, language, palette }: OverlayCardProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const isRtl = language === "he";
  const fontFamily = isRtl
    ? "'Heebo', 'Arial Hebrew', sans-serif"
    : "'Inter', 'Helvetica Neue', sans-serif";

  // Spring entrance
  const enter = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.6 },
  });
  // Fade-out in the last 10 frames of the sequence
  const exit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 10), durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const opacity = Math.min(enter, exit);
  const translate = interpolate(enter, [0, 1], [30, 0]);

  if (!text) return null;

  const direction = isRtl ? "rtl" : "ltr";
  const textAlign = isRtl ? "right" : "left";

  if (variant === "hook") {
    return (
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 64px",
          opacity,
        }}
      >
        <div
          style={{
            width: "100%",
            direction,
            textAlign,
            transform: `translateY(${translate}px)`,
          }}
        >
          <div
            style={{
              fontFamily,
              fontSize: 96,
              fontWeight: 900,
              lineHeight: 1.05,
              color: palette.text,
              textShadow: "0 6px 24px rgba(0,0,0,0.6)",
              paddingTop: 0,
              paddingBottom: 0,
              paddingLeft: 0,
              paddingRight: 0,
              letterSpacing: isRtl ? "0" : "-0.02em",
            }}
          >
            {text}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  if (variant === "lowerThird") {
    return (
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          padding: "0 48px 220px 48px",
          opacity,
        }}
      >
        <div
          style={{
            width: "100%",
            direction,
            textAlign,
            transform: `translateY(${translate}px)`,
          }}
        >
          <div
            style={{
              display: "inline-block",
              backgroundColor: palette.accent,
              paddingTop: 18,
              paddingBottom: 18,
              paddingLeft: 28,
              paddingRight: 28,
              borderRadius: 12,
              fontFamily,
              fontSize: 56,
              fontWeight: 800,
              lineHeight: 1.15,
              color: palette.text,
              maxWidth: "100%",
            }}
          >
            {text}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // cta
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: `${palette.primary}E6`, // 90% opacity primary
        padding: "0 64px",
        opacity,
      }}
    >
      <div
        style={{
          width: "100%",
          direction,
          textAlign: "center",
          transform: `translateY(${translate}px)`,
        }}
      >
        <div
          style={{
            fontFamily,
            fontSize: 120,
            fontWeight: 900,
            lineHeight: 1.05,
            color: palette.text,
            paddingTop: 0,
            paddingBottom: 24,
            paddingLeft: 0,
            paddingRight: 0,
          }}
        >
          {text}
        </div>
        <div
          style={{
            display: "inline-block",
            backgroundColor: palette.accent,
            paddingTop: 20,
            paddingBottom: 20,
            paddingLeft: 48,
            paddingRight: 48,
            borderRadius: 999,
            fontFamily,
            fontSize: 48,
            fontWeight: 700,
            color: palette.text,
          }}
        >
          →
        </div>
      </div>
    </AbsoluteFill>
  );
}
