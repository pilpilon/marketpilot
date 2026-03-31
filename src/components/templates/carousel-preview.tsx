"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, Send, Eye, EyeOff, RefreshCw } from "lucide-react";
import { PlatformPreviewFrame } from "@/components/campaigns/platform-preview-frame";
import type { TemplateRenderResult } from "@/types/templates";

interface CarouselPreviewProps {
  slides: TemplateRenderResult[];
  ratioClass: string;
  platform: string;
  onSendToComposer?: (imageUrls: string[]) => void;
  onRegenerate?: () => void;
}

export function CarouselPreview({ slides, ratioClass, platform, onSendToComposer, onRegenerate }: CarouselPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(true);

  const current = slides[currentIndex];
  if (!current) return null;

  function prev() {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }

  function next() {
    setCurrentIndex((i) => Math.min(slides.length - 1, i + 1));
  }

  function downloadAll() {
    slides.forEach((slide, idx) => {
      const a = document.createElement("a");
      a.href = slide.imageUrl;
      a.download = `slide-${idx + 1}.png`;
      a.click();
    });
  }

  function downloadCurrent() {
    const a = document.createElement("a");
    a.href = current.imageUrl;
    a.download = `slide-${currentIndex + 1}.png`;
    a.click();
  }

  return (
    <div className="space-y-3">
      {/* Preview toggle */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showPreview ? "Raw image" : "Platform preview"}
        </Button>
      </div>

      {/* Slide viewer */}
      <div className="relative">
        {showPreview ? (
          <PlatformPreviewFrame
            platform={platform}
            imageUrl={current.imageUrl}
            ratioClass={ratioClass}
          />
        ) : (
          <div className={`${ratioClass} w-full max-w-sm mx-auto rounded-lg overflow-hidden border bg-muted relative`}>
            <Image
              src={current.imageUrl}
              alt={`Slide ${currentIndex + 1}`}
              fill
              className="object-cover"
            />
          </div>
        )}

        {/* Navigation arrows (positioned outside the frame for platform preview) */}
        {slides.length > 1 && (
          <div className="flex justify-center gap-3 mt-2">
            <button
              onClick={prev}
              disabled={currentIndex === 0}
              className="rounded-full bg-muted p-1.5 disabled:opacity-30 hover:bg-muted-foreground/20 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground self-center">
              {currentIndex + 1} / {slides.length}
            </span>
            <button
              onClick={next}
              disabled={currentIndex === slides.length - 1}
              className="rounded-full bg-muted p-1.5 disabled:opacity-30 hover:bg-muted-foreground/20 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Dots indicator */}
      {slides.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentIndex
                  ? "w-4 bg-primary"
                  : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={downloadCurrent} className="flex-1">
          <Download className="me-2 h-4 w-4" />
          Download{slides.length > 1 ? " This" : ""}
        </Button>
        {slides.length > 1 && (
          <Button variant="outline" size="sm" onClick={downloadAll} className="flex-1">
            <Download className="me-2 h-4 w-4" />
            All
          </Button>
        )}
        {onRegenerate && (
          <Button variant="outline" size="sm" onClick={onRegenerate} className="flex-1">
            <RefreshCw className="me-2 h-4 w-4" />
            Regenerate
          </Button>
        )}
        {onSendToComposer && (
          <Button
            size="sm"
            onClick={() => onSendToComposer(slides.map((s) => s.imageUrl))}
            className="flex-1"
          >
            <Send className="me-2 h-4 w-4" />
            Composer
          </Button>
        )}
      </div>
    </div>
  );
}
