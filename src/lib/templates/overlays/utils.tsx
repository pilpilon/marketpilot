/** Detect if any text in the fields contains RTL characters (Hebrew, Arabic) */
export function detectDirection(fields: Record<string, string>): "rtl" | "ltr" {
  const allText = Object.values(fields).join(" ");
  const rtlPattern = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/;
  return rtlPattern.test(allText) ? "rtl" : "ltr";
}
