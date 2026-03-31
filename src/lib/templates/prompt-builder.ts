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
    "- No text overlays, no watermarks, no logos",
    `- Platform-optimized layout for ${platformLabel}`,
    "- Photorealistic or high-quality illustration (match the visual style)",
    "- Suitable for professional brand social media",
    "- People in images should match the target audience demographics described above",
  ];

  if (hasReferenceImage) {
    qualityLines.push(
      "- Incorporate the provided reference image content naturally into the scene (e.g., show the actual app UI on a device screen, place the real product in frame, use the brand asset as part of the composition)"
    );
  }

  sections.push("", `QUALITY REQUIREMENTS:\n${qualityLines.join("\n")}`);

  const prompt = sections.join("\n");

  const negativePrompt = [
    "text",
    "watermark",
    "logo",
    "low quality",
    "blurry",
    "pixelated",
    "distorted",
    "amateur",
    "cluttered",
    ...(visualDonts ? [visualDonts] : []),
  ].join(", ");

  return { prompt, negativePrompt };
}
