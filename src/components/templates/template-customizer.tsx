"use client";

import { useState, useEffect, useCallback } from "react";
import type { ContentTemplate, TemplateRenderResponse, TemplateRenderResult } from "@/types/templates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2, Sparkles, Wand2 } from "lucide-react";
import { SlideFieldForm } from "./slide-field-form";
import { OverlayPreview } from "./overlay-preview";
import { CarouselPreview } from "./carousel-preview";
import { PlatformPreviewFrame } from "@/components/campaigns/platform-preview-frame";
import { ReferenceImageUpload, type ReferenceImageData } from "@/components/reference-image-upload";
import { cn } from "@/lib/utils";

interface TemplateCustomizerProps {
  template: ContentTemplate;
  projectId: string;
  platformOptions: Array<{ value: string; label: string; ratio: string; platform: string }>;
  platformMeta: Record<string, { name: string; color: string }>;
  PlatformSvg: React.ComponentType<{ platform: string; className?: string }>;
  ratioClassMap: Record<string, string>;
  onBack: () => void;
  onResult: (response: TemplateRenderResponse) => void;
}

export function TemplateCustomizer({
  template,
  projectId,
  platformOptions,
  platformMeta,
  PlatformSvg,
  ratioClassMap,
  onBack,
  onResult,
}: TemplateCustomizerProps) {
  const t = useTranslations("creativeDesigner");
  const isCarousel = template.format === "carousel" && template.slides.length > 1;

  const [platform, setPlatform] = useState(
    template.platforms[0] || "instagram_feed"
  );
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [slideValues, setSlideValues] = useState<Record<string, Record<string, string>>>(() => {
    const initial: Record<string, Record<string, string>> = {};
    template.slides.forEach((slide) => {
      initial[slide.id] = {};
      slide.fields.forEach((field) => {
        initial[slide.id][field.id] = field.defaultValue || "";
      });
    });
    return initial;
  });
  const [customInstruction, setCustomInstruction] = useState("");
  const [generating, setGenerating] = useState(false);
  const [filling, setFilling] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TemplateRenderResponse | null>(null);
  const [referenceImage, setReferenceImage] = useState<ReferenceImageData | null>(null);

  const selectedPlatform = platformOptions.find((p) => p.value === platform);
  const ratioClass = ratioClassMap[selectedPlatform?.ratio ?? "1:1"] ?? "aspect-square";
  const activeSlide = template.slides[activeSlideIndex];

  function updateField(slideId: string, fieldId: string, value: string) {
    setSlideValues((prev) => ({
      ...prev,
      [slideId]: { ...prev[slideId], [fieldId]: value },
    }));
  }

  const autoFill = useCallback(async () => {
    setFilling(true);
    setError("");
    try {
      const res = await fetch("/api/ai/fill-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          templateName: template.name,
          templateCategory: template.category,
          slides: template.slides.map((slide) => ({
            slideId: slide.id,
            name: slide.name,
            role: slide.role,
            fields: slide.fields.map((f) => ({
              id: f.id,
              label: f.label,
              placeholder: f.placeholder,
              maxLength: f.maxLength,
              required: f.required,
            })),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Auto-fill failed");
        setFilling(false);
        return;
      }

      // Apply AI-generated values to slide fields
      if (data.slides) {
        setSlideValues((prev) => {
          const next = { ...prev };
          for (const [slideId, fields] of Object.entries(data.slides as Record<string, Record<string, string>>)) {
            if (next[slideId]) {
              next[slideId] = { ...next[slideId], ...fields };
            }
          }
          return next;
        });
      }
    } catch {
      setError("Failed to auto-fill");
    }
    setFilling(false);
  }, [projectId, template]);

  // Auto-fill on mount
  useEffect(() => {
    autoFill();
  }, [autoFill]);

  async function generate() {
    setGenerating(true);
    setError("");
    setResult(null);

    const slides = template.slides.map((slide) => ({
      slideId: slide.id,
      fieldValues: slideValues[slide.id] || {},
    }));

    try {
      const res = await fetch("/api/skills/template-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          templateId: template.id,
          platform,
          slides,
          customInstruction: customInstruction.trim() || undefined,
          referenceImage: referenceImage
            ? { base64: referenceImage.base64, mimeType: referenceImage.mimeType }
            : undefined,
        }),
      });

      const data = await res.json();
      setGenerating(false);

      if (!res.ok) {
        setError(data.error || "Generation failed");
        return;
      }

      setResult(data);
      onResult(data);
    } catch (err) {
      setGenerating(false);
      setError("Network error");
    }
  }

  // Check if required fields are filled
  const hasRequiredFields = template.slides.every((slide) =>
    slide.fields
      .filter((f) => f.required)
      .every((f) => (slideValues[slide.id]?.[f.id] || "").trim().length > 0)
  );

  // ─── Result View ─────────────────────────────────────────────────────────

  if (result) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {template.name}
              <Badge variant="secondary" className="text-xs font-mono">
                {selectedPlatform?.ratio}
              </Badge>
              {isCarousel && (
                <Badge variant="outline" className="text-xs">
                  {result.slides.length} {t("slides")}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CarouselPreview
              slides={result.slides}
              ratioClass={ratioClass}
              platform={platform}
            />
          </CardContent>
        </Card>
        <Button variant="outline" onClick={onBack} className="w-full">
          <ArrowLeft className="me-2 h-4 w-4" />
          {t("createAnother")}
        </Button>
      </div>
    );
  }

  // ─── Customizer View ─────────────────────────────────────────────────────

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left: Form */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <CardTitle className="text-base">{template.name}</CardTitle>
                <CardDescription className="text-xs">{template.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Platform */}
            <div className="space-y-1.5">
              <Label>{t("platformAndFormat")}</Label>
              <Select value={platform} onValueChange={(val) => val && setPlatform(val)}>
                <SelectTrigger>
                  <SelectValue>
                    {selectedPlatform && (
                      <span className="flex items-center gap-2">
                        <PlatformSvg platform={selectedPlatform.platform} className={`h-4 w-4 ${platformMeta[selectedPlatform.platform]?.color}`} />
                        <span>{platformMeta[selectedPlatform.platform]?.name} — {selectedPlatform.label}</span>
                        <span className="text-muted-foreground text-xs ms-1">({selectedPlatform.ratio})</span>
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {platformOptions
                    .filter((p) => template.platforms.includes(p.value) || template.platforms.includes(p.platform))
                    .map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className="flex items-center gap-2">
                          <span>{platformMeta[p.platform]?.name} — {p.label}</span>
                          <span className="text-muted-foreground text-xs">({p.ratio})</span>
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Slide tabs for carousel */}
            {isCarousel && (
              <div className="flex gap-1 overflow-x-auto pb-1">
                {template.slides.map((slide, idx) => (
                  <button
                    key={slide.id}
                    onClick={() => setActiveSlideIndex(idx)}
                    className={cn(
                      "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      idx === activeSlideIndex
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {idx + 1}. {slide.name}
                  </button>
                ))}
              </div>
            )}

            {/* AI Auto-Fill */}
            <Button
              variant="outline"
              size="sm"
              onClick={autoFill}
              disabled={filling || generating}
              className="w-full"
            >
              {filling ? (
                <>
                  <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />
                  {t("fillingWithAi")}
                </>
              ) : (
                <>
                  <Wand2 className="me-2 h-3.5 w-3.5" />
                  {t("regenerateCopyWithAi")}
                </>
              )}
            </Button>

            {/* Slide fields */}
            {activeSlide && (
              <SlideFieldForm
                slide={activeSlide}
                values={slideValues[activeSlide.id] || {}}
                onChange={(fieldId, value) => updateField(activeSlide.id, fieldId, value)}
              />
            )}

            {/* Reference image */}
            <div className="space-y-1.5">
              <Label>
                {t("referenceImage")}
                <span className="ms-1 text-muted-foreground font-normal">{t("optional")}</span>
              </Label>
              <ReferenceImageUpload
                value={referenceImage}
                onChange={setReferenceImage}
                onError={setError}
              />
              <p className="text-xs text-muted-foreground">
                {t("referenceImageHint")}
              </p>
            </div>

            {/* Custom style direction */}
            <div className="space-y-1.5">
              <Label>
                {t("styleDirection")}
                <span className="ms-1 text-muted-foreground font-normal">{t("optional")}</span>
              </Label>
              <Textarea
                placeholder={t("styleDirectionPlaceholder")}
                rows={2}
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              onClick={generate}
              disabled={generating || filling || !hasRequiredFields}
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {isCarousel ? t("generatingSlides", { count: template.slides.length }) : t("generatingImage")}
                </>
              ) : (
                <>
                  <Sparkles className="me-2 h-4 w-4" />
                  {isCarousel ? t("generateSlides", { count: template.slides.length }) : t("generateVisual")}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Right: Preview */}
      <div className="space-y-4">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {t("preview")}
              <Badge variant="secondary" className="text-xs font-mono">
                {selectedPlatform?.ratio}
              </Badge>
              {isCarousel && (
                <Badge variant="outline" className="text-xs">
                  {t("slide")} {activeSlideIndex + 1}/{template.slides.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {generating ? (
              <div className={`${ratioClass} w-full max-w-sm mx-auto rounded-lg bg-muted flex flex-col items-center justify-center gap-3`}>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {isCarousel
                    ? t("generatingSlide", { count: template.slides.length })
                    : t("generatingWithNanoBanana")}
                </p>
              </div>
            ) : activeSlide ? (
              <PlatformPreviewFrame
                platform={platform}
                ratioClass={ratioClass}
              >
                <OverlayPreview
                  overlayStyle={activeSlide.overlayStyle}
                  fields={slideValues[activeSlide.id] || {}}
                  ratioClass={ratioClass}
                />
              </PlatformPreviewFrame>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
