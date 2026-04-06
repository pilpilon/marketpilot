/**
 * Build the full image generation prompt incorporating ALL brand intelligence.
 */
export function buildImagePrompt(params: {
  postContent: string;
  platform: string;
  styleKeywords: string;
  colorPalette: string;
  visualDonts: string;
  brandPersonality: string;
  audienceContext?: string;
  brandPositioning?: string;
  productContext?: string;
  intakePatterns?: string;
  hasReferenceImage?: boolean;
  isAutoScreenshot?: boolean;
  platformTypes?: string[];
  customInstruction?: string;
}): { prompt: string; negativePrompt: string } {
  const {
    postContent,
    platform,
    styleKeywords,
    colorPalette,
    visualDonts,
    brandPersonality,
    audienceContext,
    brandPositioning,
    productContext,
    intakePatterns,
    hasReferenceImage,
    isAutoScreenshot,
    platformTypes,
    customInstruction,
  } = params;

  const platformLabel = platform.replace("_", " ");

  const sections: string[] = [
    `Create a high-quality ${platformLabel} social media visual.`,
    "",
    `VISUAL STYLE DIRECTION:\n${styleKeywords}`,
    "",
    `COLOR PALETTE & MOOD:\n${colorPalette}`,
    "",
    `BRAND PERSONALITY:\n${brandPersonality}`,
  ];

  if (audienceContext) {
    sections.push(
      "",
      `TARGET AUDIENCE (depict people and scenarios matching these personas):\n${audienceContext}`
    );
  }

  if (brandPositioning) {
    sections.push("", `BRAND POSITIONING:\n${brandPositioning}`);
  }

  if (productContext) {
    sections.push("", `PRODUCT CONTEXT:\n${productContext}`);
  }

  if (intakePatterns) {
    sections.push(
      "",
      `PROVEN CONTENT PATTERNS (from successful past examples — follow these visual patterns):\n${intakePatterns}`
    );
  }

  sections.push("", `CONTENT TO VISUALIZE:\n${postContent}`);

  if (customInstruction) {
    sections.push("", `SPECIFIC DIRECTION:\n${customInstruction}`);
  }

  const qualityLines = [
    "- Studio-quality, editorial-grade composition",
    "- Crisp details, intentional whitespace",
    "- CRITICAL: Do NOT include ANY text, words, letters, numbers, typography, captions, titles, headings, labels, or written content anywhere in the image. The image must be purely visual — text will be added separately as an overlay.",
    "- No watermarks, no logos, no brand names, no UI elements",
    `- Platform-optimized layout for ${platformLabel}`,
    "- Photorealistic or high-quality illustration (match the visual style)",
    "- Suitable for professional brand social media",
    "- People in images should match the target audience demographics described above",
  ];

  if (hasReferenceImage) {
    if (isAutoScreenshot) {
      qualityLines.push(
        "- The reference image shows the ACTUAL app/website interface in a device frame. Show this exact interface on a device screen in the scene. Do NOT replace it with generic dashboards, graphs, or placeholder UI."
      );
    } else {
      qualityLines.push(
        "- Incorporate the provided reference image content naturally into the scene (e.g., show the actual app UI on a device screen, place the real product in frame, use the brand asset as part of the composition)"
      );
    }
  }

  // Platform type guard — prevent AI from showing app stores if product has no native app
  const hasMobileApp = platformTypes?.some((p) => p === "ios" || p === "android");
  const hasPWA = platformTypes?.some((p) => p === "pwa");
  if (platformTypes?.length && !hasMobileApp) {
    if (hasPWA) {
      qualityLines.push(
        "- This product is a PWA (mobile web app). It IS okay to show someone using it on a phone/tablet. Do NOT show app stores, app download prompts, or 'available on App Store/Google Play' messaging."
      );
    } else {
      qualityLines.push(
        "- This product is a WEBSITE, not a mobile app. Do NOT show app stores, app download prompts, or people using mobile apps unless a reference image explicitly shows a mobile interface."
      );
    }
  }

  // Content safety — applies to ALL asset generation globally
  qualityLines.push(
    "- CONTENT SAFETY: Do NOT include any religious symbols (crosses, Stars of David, crescents, menorahs, churches, mosques, synagogues), national flags, national emblems, political imagery, military imagery, or culturally controversial symbols. Keep visuals culturally neutral — focus on the product, people, and lifestyle."
  );

  sections.push("", `QUALITY REQUIREMENTS:\n${qualityLines.join("\n")}`);

  const prompt = sections.join("\n");

  const negativePrompt = [
    "text", "words", "letters", "numbers", "typography", "captions", "titles", "labels", "writing", "font",
    "watermark",
    "logo",
    "low quality",
    "blurry",
    "pixelated",
    "distorted",
    "amateur",
    "cluttered",
    "religious symbols", "cross", "star of david", "crescent", "menorah", "church", "mosque", "synagogue",
    "national flag", "flag", "national emblem", "political", "military", "controversial",
    ...(visualDonts ? [visualDonts] : []),
  ].join(", ");

  return { prompt, negativePrompt };
}
