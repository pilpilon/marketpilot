import type { PlatformDimensions } from "@/types/templates";

/** Platform key → default aspect ratio */
export const PLATFORM_RATIOS: Record<string, string> = {
  instagram_feed: "4:5",
  instagram_square: "1:1",
  instagram_story: "9:16",
  instagram_reel: "9:16",
  twitter: "16:9",
  twitter_square: "1:1",
  tiktok: "9:16",
  linkedin: "1:1",
  linkedin_landscape: "16:9",
};

/** Aspect ratio → pixel dimensions */
export const RATIO_DIMS: Record<string, { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "9:16": { w: 1080, h: 1920 },
  "16:9": { w: 1920, h: 1080 },
};

/** Platform key → full dimensions with safe zones */
export function getPlatformDimensions(platform: string): PlatformDimensions {
  const ratio = PLATFORM_RATIOS[platform] || "1:1";
  const dims = RATIO_DIMS[ratio] || RATIO_DIMS["1:1"];

  // Safe zones: pixels to keep clear from edges (UI overlays, handles, etc.)
  const isStory = ratio === "9:16";
  const safeZone = isStory
    ? { top: 250, bottom: 250, left: 40, right: 40 } // Story/Reel: top and bottom for platform UI
    : { top: 40, bottom: 40, left: 40, right: 40 };  // Feed posts: minimal margins

  return {
    width: dims.w,
    height: dims.h,
    aspectRatio: ratio,
    safeZone,
  };
}
