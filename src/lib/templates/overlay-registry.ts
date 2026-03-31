import type { OverlayStyle, OverlayRenderer } from "@/types/templates";
import {
  CenteredOverlay,
  BottomBarOverlay,
  GradientOverlay,
  FullOverlay,
  SplitLayoutOverlay,
  BoxedBadgeOverlay,
  CornerOverlay,
} from "./overlays";

export const overlayRegistry: Record<OverlayStyle, OverlayRenderer> = {
  centered: CenteredOverlay,
  bottom_bar: BottomBarOverlay,
  gradient_overlay: GradientOverlay,
  full_overlay: FullOverlay,
  split_layout: SplitLayoutOverlay,
  boxed_badge: BoxedBadgeOverlay,
  corner: CornerOverlay,
};

export function getOverlayRenderer(style: OverlayStyle): OverlayRenderer {
  const renderer = overlayRegistry[style];
  if (!renderer) {
    throw new Error(`Unknown overlay style: ${style}`);
  }
  return renderer;
}
