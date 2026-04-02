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
 * Reverse only Hebrew character runs within a mixed token, keeping digits
 * and Latin chars in their original LTR order.
 * e.g. "ל-800" → the Hebrew part reverses but "800" stays as-is.
 */
function reverseHebrewOnly(s: string): string {
  // Split into runs of Hebrew chars vs non-Hebrew chars
  const runs = s.match(/([\u0590-\u05FF]+|[^\u0590-\u05FF]+)/g);
  if (!runs) return s;
  return runs
    .map((run) => (HEBREW_PATTERN.test(run) ? reverseGraphemes(run) : run))
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
  const { direction: _dir, textAlign: _ta, wordBreak: _wb, ...restStyle } = style;

  return (
    <div
      style={{
        ...restStyle,
        display: "flex",
        flexDirection: "row-reverse",
        flexWrap: "wrap",
        justifyContent: "flex-start",
        alignItems: "baseline",
        width: "100%",
        maxWidth: "100%",
        overflow: "hidden",
      }}
    >
      {words.map((word, i) => (
        <span key={i} style={{
          whiteSpace: "pre",
          ...(i < words.length - 1 ? { marginLeft: "0.25em" } : {}),
        }}>
          {HEBREW_PATTERN.test(word) ? reverseHebrewOnly(word) : word}
        </span>
      ))}
    </div>
  );
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
    return reverseHebrewOnly(token);
  });
  // Reverse the entire array so word order is correct in LTR rendering
  return processed.reverse().join("");
}
