import React from "react";

/** Detect if any text in the fields contains RTL characters (Hebrew, Arabic) */
export function detectDirection(fields: Record<string, string>): "rtl" | "ltr" {
  const allText = Object.values(fields).join(" ");
  const rtlPattern = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/;
  return rtlPattern.test(allText) ? "rtl" : "ltr";
}

const HEBREW_PATTERN = /[\u0590-\u05FF]/;

/**
 * Reverse graphemes within a single token.
 */
function reverseGraphemes(s: string): string {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(s))
    .map((seg) => seg.segment)
    .reverse()
    .join("");
}

/**
 * Satori does not implement the Unicode Bidi Algorithm.
 * `direction: rtl` CSS does NOT reorder characters or handle multi-line wrapping.
 *
 * Solution: render RTL text as a flexbox with `flex-direction: row-reverse` and
 * `flex-wrap: wrap`. Each word is a separate <span>. Hebrew words have their
 * characters reversed so they read correctly in LTR glyph rendering.
 * English/Latin words are kept as-is.
 *
 * This gives us:
 * - Correct character order within words ✓
 * - Correct word order (right-to-left) ✓
 * - Correct multi-line wrapping (line 1 = beginning of sentence) ✓
 * - English words preserved ✓
 */
export function RtlTextBlock(props: {
  text: string;
  style: React.CSSProperties;
}): React.ReactElement {
  const { text, style } = props;
  if (!text) return <div style={style} />;

  const words = text.split(/\s+/).filter(Boolean);

  // Build the flex container — row-reverse handles RTL word ordering + line wrapping
  // Satori doesn't support `gap` on flex containers, so we use marginLeft for word spacing
  const { direction: _dir, textAlign: _ta, ...restStyle } = style;

  return (
    <div
      style={{
        ...restStyle,
        display: "flex",
        flexDirection: "row-reverse",
        flexWrap: "wrap",
        justifyContent: "flex-start",
        alignItems: "baseline",
      }}
    >
      {words.map((word, i) => (
        <span key={i} style={{
          whiteSpace: "pre",
          ...(i < words.length - 1 ? { marginLeft: "0.25em" } : {}),
        }}>
          {HEBREW_PATTERN.test(word) ? reverseGraphemes(word) : word}
        </span>
      ))}
    </div>
  );
}

/**
 * Dynamically scale font size so text fits within the available width.
 * Hebrew characters are ~0.75em wide on average (wider than Latin ~0.5em).
 * Iteratively shrinks until text fits in maxLines. Floor is 40% of base.
 */
export function scaleFontSize(
  baseFontSize: number,
  text: string,
  availableWidth: number,
  maxLines = 3
): number {
  if (!text || !availableWidth) return baseFontSize;

  let fontSize = baseFontSize;
  const minFont = Math.round(baseFontSize * 0.4);
  const hasHebrew = /[\u0590-\u05FF]/.test(text);
  const charWidthRatio = hasHebrew ? 0.75 : 0.55;

  while (fontSize > minFont) {
    const avgCharWidth = fontSize * charWidthRatio;
    const charsPerLine = Math.floor(availableWidth / avgCharWidth);
    if (charsPerLine <= 0) break;
    const linesNeeded = Math.ceil(text.length / charsPerLine);
    if (linesNeeded <= maxLines) return fontSize;
    fontSize -= 2;
  }

  return Math.max(fontSize, minFont);
}

/**
 * Legacy string-based visual RTL — still used by overlay-preview.tsx (CSS client-side).
 * For Satori overlays, use RtlTextBlock instead.
 */
export function toVisualRtl(text: string): string {
  if (!text) return text;
  const tokens = text.split(/(\s+)/);
  const processed = tokens.map((token) => {
    if (/^\s+$/.test(token)) return token;
    if (!HEBREW_PATTERN.test(token)) return token;
    return reverseGraphemes(token);
  });
  // Reverse the entire array so word order is correct in LTR rendering
  return processed.reverse().join("");
}
