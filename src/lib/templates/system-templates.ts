import type { ContentTemplate } from "@/types/templates";

/**
 * Built-in system templates bundled with MarketPilot.
 * These are defined in code (not DB) because their overlay rendering functions
 * are TypeScript/JSX references resolved via the overlay registry at render time.
 */
export const SYSTEM_TEMPLATES: ContentTemplate[] = [
  // ─── Single-Image Templates ──────────────────────────────────────────────

  {
    id: "sys-promo-bottom-bar",
    name: "Promotional — Bottom Bar",
    description: "Bold headline + CTA on a colored bar at the bottom. Perfect for product launches and offers.",
    category: "promotional",
    format: "single",
    platforms: ["instagram_feed", "instagram_square", "twitter", "linkedin", "facebook"],
    slides: [
      {
        id: "main",
        name: "Main",
        role: "standalone",
        overlayStyle: "bottom_bar",
        aiPromptHint: "Product or lifestyle photo, clean composition with space at bottom for text overlay",
        fields: [
          { id: "headline", label: "Headline", type: "text", placeholder: "e.g. New Collection Out Now", maxLength: 60, required: true },
          { id: "subheadline", label: "Subheadline", type: "text", placeholder: "e.g. 30% off for early birds", maxLength: 100, required: false },
          { id: "cta", label: "Call to Action", type: "text", placeholder: "e.g. Shop Now →", maxLength: 30, required: false },
        ],
      },
    ],
    defaultOverlayStyle: "bottom_bar",
    brandTokens: { useBrandColors: true, useBrandFonts: true, useLogoWatermark: false },
    isSystem: true,
  },

  {
    id: "sys-educational-gradient",
    name: "Educational — Gradient",
    description: "Tip or fact with a gradient text overlay from the bottom. Great for educational/how-to content.",
    category: "educational",
    format: "single",
    platforms: ["instagram_feed", "instagram_square", "twitter", "linkedin", "facebook"],
    slides: [
      {
        id: "main",
        name: "Main",
        role: "standalone",
        overlayStyle: "gradient_overlay",
        aiPromptHint: "Relevant thematic background, professional and clean, good for text overlay at bottom",
        fields: [
          { id: "headline", label: "Tip / Title", type: "text", placeholder: "e.g. 5 Ways to Boost Engagement", maxLength: 80, required: true },
          { id: "subheadline", label: "Supporting text", type: "textarea", placeholder: "Brief explanation or teaser", maxLength: 150, required: false },
        ],
      },
    ],
    defaultOverlayStyle: "gradient_overlay",
    brandTokens: { useBrandColors: true, useBrandFonts: true, useLogoWatermark: false },
    isSystem: true,
  },

  {
    id: "sys-quote-centered",
    name: "Quote — Centered",
    description: "Inspirational or thought-leadership quote centered on a visual background.",
    category: "quote",
    format: "single",
    platforms: ["instagram_feed", "instagram_square", "linkedin", "twitter", "facebook"],
    slides: [
      {
        id: "main",
        name: "Main",
        role: "standalone",
        overlayStyle: "centered",
        aiPromptHint: "Abstract, atmospheric, or nature background with soft focus. Minimal and elegant.",
        fields: [
          { id: "headline", label: "Quote", type: "textarea", placeholder: "The quote text…", maxLength: 200, required: true },
          { id: "subheadline", label: "Attribution", type: "text", placeholder: "e.g. — Steve Jobs", maxLength: 50, required: false },
        ],
      },
    ],
    defaultOverlayStyle: "centered",
    brandTokens: { useBrandColors: true, useBrandFonts: true, useLogoWatermark: false },
    isSystem: true,
  },

  {
    id: "sys-announcement-full",
    name: "Announcement — Full Overlay",
    description: "Big news deserves a big statement. Full-screen brand color overlay with bold text.",
    category: "announcement",
    format: "single",
    platforms: ["instagram_feed", "instagram_square", "instagram_story", "twitter", "linkedin", "facebook"],
    slides: [
      {
        id: "main",
        name: "Main",
        role: "standalone",
        overlayStyle: "full_overlay",
        aiPromptHint: "Abstract texture, geometric pattern, or celebratory visual as background",
        fields: [
          { id: "headline", label: "Announcement", type: "text", placeholder: "e.g. WE'RE LAUNCHING!", maxLength: 50, required: true },
          { id: "subheadline", label: "Details", type: "textarea", placeholder: "What, when, where…", maxLength: 150, required: false },
          { id: "cta", label: "Call to Action", type: "text", placeholder: "e.g. Learn More", maxLength: 30, required: false },
        ],
      },
    ],
    defaultOverlayStyle: "full_overlay",
    brandTokens: { useBrandColors: true, useBrandFonts: true, useLogoWatermark: false },
    isSystem: true,
  },

  {
    id: "sys-product-split",
    name: "Product Showcase — Split",
    description: "Half image, half text. Clean split layout for showcasing products or features.",
    category: "product_showcase",
    format: "single",
    platforms: ["instagram_feed", "instagram_square", "twitter", "linkedin", "facebook"],
    slides: [
      {
        id: "main",
        name: "Main",
        role: "standalone",
        overlayStyle: "split_layout",
        aiPromptHint: "Product photo or lifestyle shot, subject on the left side of the frame, clean background",
        fields: [
          { id: "headline", label: "Product Name / Title", type: "text", placeholder: "e.g. Premium Wireless Earbuds", maxLength: 50, required: true },
          { id: "subheadline", label: "Key Benefit", type: "textarea", placeholder: "e.g. 24-hour battery life with studio-quality sound", maxLength: 120, required: false },
          { id: "cta", label: "CTA", type: "text", placeholder: "e.g. Order Now", maxLength: 25, required: false },
        ],
      },
    ],
    defaultOverlayStyle: "split_layout",
    brandTokens: { useBrandColors: true, useBrandFonts: true, useLogoWatermark: false },
    isSystem: true,
  },

  {
    id: "sys-testimonial-badge",
    name: "Testimonial — Badge Card",
    description: "Customer quote in an elegant white card with a quote mark accent.",
    category: "testimonial",
    format: "single",
    platforms: ["instagram_feed", "instagram_square", "linkedin", "facebook"],
    slides: [
      {
        id: "main",
        name: "Main",
        role: "standalone",
        overlayStyle: "boxed_badge",
        aiPromptHint: "Soft, blurred lifestyle or abstract background. Warm and inviting tones.",
        fields: [
          { id: "headline", label: "Testimonial quote", type: "textarea", placeholder: "What the customer said…", maxLength: 200, required: true },
          { id: "subheadline", label: "Context", type: "text", placeholder: "e.g. After using for 3 months", maxLength: 80, required: false },
          { id: "attribution", label: "Customer name", type: "text", placeholder: "e.g. Sarah M., CEO", maxLength: 40, required: false },
        ],
      },
    ],
    defaultOverlayStyle: "boxed_badge",
    brandTokens: { useBrandColors: true, useBrandFonts: true, useLogoWatermark: false },
    isSystem: true,
  },

  // ─── Carousel Templates ──────────────────────────────────────────────────

  {
    id: "sys-edu-carousel-5",
    name: "Educational Carousel (5 Slides)",
    description: "Hook → 3 tips → CTA. The best-performing format for educational Instagram and LinkedIn content.",
    category: "educational",
    format: "carousel",
    platforms: ["instagram_feed", "instagram_square", "linkedin"],
    slides: [
      {
        id: "hook",
        name: "Hook Slide",
        role: "hook",
        overlayStyle: "full_overlay",
        aiPromptHint: "Bold abstract or thematic background that grabs attention. High contrast.",
        fields: [
          { id: "headline", label: "Hook headline", type: "text", placeholder: "e.g. 5 Mistakes Killing Your Reach", maxLength: 60, required: true },
          { id: "subheadline", label: "Subtitle", type: "text", placeholder: "e.g. And how to fix them today", maxLength: 80, required: false },
        ],
      },
      {
        id: "tip-1",
        name: "Tip 1",
        role: "content",
        overlayStyle: "bottom_bar",
        aiPromptHint: "Relevant visual for tip 1, clean and professional",
        fields: [
          { id: "headline", label: "Tip 1", type: "text", placeholder: "e.g. Post at peak hours", maxLength: 50, required: true },
          { id: "subheadline", label: "Detail", type: "textarea", placeholder: "Brief explanation", maxLength: 120, required: false },
        ],
      },
      {
        id: "tip-2",
        name: "Tip 2",
        role: "content",
        overlayStyle: "bottom_bar",
        aiPromptHint: "Relevant visual for tip 2, clean and professional",
        fields: [
          { id: "headline", label: "Tip 2", type: "text", placeholder: "e.g. Use carousel posts", maxLength: 50, required: true },
          { id: "subheadline", label: "Detail", type: "textarea", placeholder: "Brief explanation", maxLength: 120, required: false },
        ],
      },
      {
        id: "tip-3",
        name: "Tip 3",
        role: "content",
        overlayStyle: "bottom_bar",
        aiPromptHint: "Relevant visual for tip 3, clean and professional",
        fields: [
          { id: "headline", label: "Tip 3", type: "text", placeholder: "e.g. Engage in comments", maxLength: 50, required: true },
          { id: "subheadline", label: "Detail", type: "textarea", placeholder: "Brief explanation", maxLength: 120, required: false },
        ],
      },
      {
        id: "cta",
        name: "CTA Slide",
        role: "cta",
        overlayStyle: "centered",
        aiPromptHint: "Brand-colored abstract background, subtle and clean for a final call to action",
        fields: [
          { id: "headline", label: "CTA headline", type: "text", placeholder: "e.g. Save this post!", maxLength: 40, required: true },
          { id: "subheadline", label: "CTA text", type: "text", placeholder: "e.g. Follow @brand for more tips", maxLength: 80, required: false },
        ],
      },
    ],
    defaultOverlayStyle: "bottom_bar",
    brandTokens: { useBrandColors: true, useBrandFonts: true, useLogoWatermark: false },
    isSystem: true,
  },

  {
    id: "sys-launch-carousel-4",
    name: "Product Launch Carousel (4 Slides)",
    description: "Hook → 2 feature highlights → CTA. Perfect for new product or feature announcements.",
    category: "product_showcase",
    format: "carousel",
    platforms: ["instagram_feed", "instagram_square", "linkedin"],
    slides: [
      {
        id: "hook",
        name: "Hook",
        role: "hook",
        overlayStyle: "full_overlay",
        aiPromptHint: "Dramatic product hero shot or bold abstract visual, premium feel",
        fields: [
          { id: "headline", label: "Launch headline", type: "text", placeholder: "e.g. INTRODUCING PRO X", maxLength: 40, required: true },
          { id: "subheadline", label: "Tagline", type: "text", placeholder: "e.g. The future of productivity", maxLength: 60, required: false },
        ],
      },
      {
        id: "feature-1",
        name: "Feature 1",
        role: "content",
        overlayStyle: "gradient_overlay",
        aiPromptHint: "Visual representing feature 1, modern and clean",
        fields: [
          { id: "headline", label: "Feature 1", type: "text", placeholder: "e.g. 10x Faster Processing", maxLength: 50, required: true },
          { id: "subheadline", label: "Description", type: "textarea", placeholder: "Brief feature description", maxLength: 120, required: false },
        ],
      },
      {
        id: "feature-2",
        name: "Feature 2",
        role: "content",
        overlayStyle: "gradient_overlay",
        aiPromptHint: "Visual representing feature 2, modern and clean",
        fields: [
          { id: "headline", label: "Feature 2", type: "text", placeholder: "e.g. AI-Powered Insights", maxLength: 50, required: true },
          { id: "subheadline", label: "Description", type: "textarea", placeholder: "Brief feature description", maxLength: 120, required: false },
        ],
      },
      {
        id: "cta",
        name: "CTA",
        role: "cta",
        overlayStyle: "full_overlay",
        aiPromptHint: "Clean, premium background that supports a clear call to action",
        fields: [
          { id: "headline", label: "CTA", type: "text", placeholder: "e.g. Available Now", maxLength: 30, required: true },
          { id: "subheadline", label: "Details", type: "text", placeholder: "e.g. Link in bio", maxLength: 60, required: false },
          { id: "cta", label: "Button text", type: "text", placeholder: "e.g. Get Early Access", maxLength: 25, required: false },
        ],
      },
    ],
    defaultOverlayStyle: "gradient_overlay",
    brandTokens: { useBrandColors: true, useBrandFonts: true, useLogoWatermark: false },
    isSystem: true,
  },
];

/**
 * Find a system template by ID.
 */
export function findSystemTemplate(id: string): ContentTemplate | undefined {
  return SYSTEM_TEMPLATES.find((t) => t.id === id);
}
