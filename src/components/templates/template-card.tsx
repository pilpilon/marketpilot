"use client";

import Image from "next/image";
import type { ContentTemplate, OverlayStyle } from "@/types/templates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Layers, SlidersHorizontal } from "lucide-react";

interface TemplateCardProps {
  template: ContentTemplate;
  onSelect: (template: ContentTemplate) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  promotional: "Promo",
  educational: "Educational",
  quote: "Quote",
  product_showcase: "Product",
  testimonial: "Testimonial",
  announcement: "Announcement",
  behind_the_scenes: "BTS",
  event: "Event",
  question_poll: "Poll",
  statistic: "Stats",
  listicle: "Listicle",
  comparison: "Compare",
  ugc: "UGC",
  story_cover: "Story",
};

const OVERLAY_LABELS: Record<string, string> = {
  centered: "Centered text",
  bottom_bar: "Bottom bar",
  gradient_overlay: "Gradient fade",
  full_overlay: "Full overlay",
  split_layout: "Split layout",
  boxed_badge: "Card badge",
  corner: "Corner text",
};

/** Map template IDs to their thumbnail background images */
const THUMBNAIL_IMAGES: Record<string, string> = {
  "sys-promo-bottom-bar": "/templates/thumb-bottom-bar.png",
  "sys-educational-gradient": "/templates/thumb-gradient.png",
  "sys-quote-centered": "/templates/thumb-centered.png",
  "sys-announcement-full": "/templates/thumb-full-overlay.png",
  "sys-product-split": "/templates/thumb-split.png",
  "sys-testimonial-badge": "/templates/thumb-badge.png",
  "sys-edu-carousel-5": "/templates/thumb-edu-carousel.png",
  "sys-launch-carousel-4": "/templates/thumb-split.png",
};

/** Thumbnail with real AI background image + CSS overlay pattern on top */
function OverlayThumbnail({
  style,
  isCarousel,
  templateId,
}: {
  style: OverlayStyle;
  isCarousel: boolean;
  templateId: string;
}) {
  const brand = "#6366f1";
  const accent = "#ec4899";
  const bgImage = THUMBNAIL_IMAGES[templateId];

  return (
    <div className="aspect-[4/3] rounded-lg overflow-hidden relative">
      {/* Real background image */}
      {bgImage ? (
        <Image
          src={bgImage}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, 300px"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400" />
      )}

      {/* Carousel indicator */}
      {isCarousel && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-black/50 rounded-full px-2 py-0.5">
          <Layers className="h-2.5 w-2.5 text-white" />
          <span className="text-[9px] text-white font-medium">Carousel</span>
        </div>
      )}

      {/* Overlay pattern */}
      {style === "centered" && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="bg-black/50 rounded-lg px-4 py-3 text-center w-[75%]">
            <div className="h-2 bg-white/90 rounded-full w-[80%] mx-auto" />
            <div className="h-1.5 bg-white/60 rounded-full w-[55%] mx-auto mt-1.5" />
          </div>
        </div>
      )}

      {style === "bottom_bar" && (
        <div className="absolute inset-x-0 bottom-0 px-3 py-3" style={{ backgroundColor: brand + "e6" }}>
          <div className="h-2 bg-white/90 rounded-full w-[70%]" />
          <div className="h-1.5 bg-white/60 rounded-full w-[50%] mt-1.5" />
          <div className="h-4 bg-white rounded mt-2 w-[35%]" style={{ opacity: 0.9 }} />
        </div>
      )}

      {style === "gradient_overlay" && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-3">
          <div className="h-2 bg-white/90 rounded-full w-[65%]" />
          <div className="h-1.5 bg-white/60 rounded-full w-[45%] mt-1.5" />
        </div>
      )}

      {style === "full_overlay" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4" style={{ backgroundColor: brand + "cc" }}>
          <div className="h-2.5 bg-white/90 rounded-full w-[65%]" />
          <div className="h-1.5 bg-white/60 rounded-full w-[45%] mt-2" />
          <div className="h-4 bg-white rounded mt-3 w-[30%]" style={{ opacity: 0.9 }} />
        </div>
      )}

      {style === "split_layout" && (
        <div className="absolute inset-0 flex flex-row">
          <div className="flex-1" />
          <div className="w-[45%] flex flex-col justify-center p-3 gap-1.5" style={{ backgroundColor: brand + "f0" }}>
            <div className="h-2 bg-white/90 rounded-full w-[80%]" />
            <div className="h-1.5 bg-white/60 rounded-full w-[60%]" />
            <div className="h-3.5 bg-white rounded mt-1 w-[45%]" style={{ opacity: 0.9 }} />
          </div>
        </div>
      )}

      {style === "boxed_badge" && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-3 shadow-md w-[75%]">
            <div className="text-lg font-bold leading-none" style={{ color: accent }}>{"\u201C"}</div>
            <div className="h-1.5 bg-gray-300 rounded-full w-[85%] mt-1" />
            <div className="h-1.5 bg-gray-300 rounded-full w-[65%] mt-1" />
            <div className="flex items-center gap-1.5 mt-2">
              <div className="w-4 h-0.5" style={{ backgroundColor: accent }} />
              <div className="h-1 bg-gray-400 rounded-full w-[35%]" />
            </div>
          </div>
        </div>
      )}

      {style === "corner" && (
        <div className="absolute inset-0 flex flex-col justify-end items-start p-3">
          <div className="bg-black/55 rounded-lg px-3 py-2 max-w-[60%]" style={{ borderLeft: `3px solid ${accent}` }}>
            <div className="h-2 bg-white/90 rounded-full w-[90%]" />
            <div className="h-1.5 bg-white/60 rounded-full w-[65%] mt-1" />
          </div>
        </div>
      )}
    </div>
  );
}

export function TemplateCard({ template, onSelect }: TemplateCardProps) {
  const isCarousel = template.format === "carousel";

  return (
    <Card
      className="cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 hover:shadow-md"
      onClick={() => onSelect(template)}
    >
      <CardContent className="p-4 space-y-3">
        <OverlayThumbnail
          style={template.defaultOverlayStyle}
          isCarousel={isCarousel}
          templateId={template.id}
        />

        {/* Template info */}
        <div className="space-y-1.5">
          <h3 className="font-semibold text-sm leading-tight">{template.name}</h3>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {template.description}
          </p>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-[10px]">
            {CATEGORY_LABELS[template.category] || template.category}
          </Badge>
          {isCarousel && (
            <Badge variant="outline" className="text-[10px]">
              {template.slides.length} slides
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            <SlidersHorizontal className="h-2.5 w-2.5 mr-1" />
            {OVERLAY_LABELS[template.defaultOverlayStyle] || template.defaultOverlayStyle}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
