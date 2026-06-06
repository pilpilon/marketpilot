"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  ImageIcon,
  Download,
  RefreshCw,
  Sparkles,
  Send,
  Eye,
  EyeOff,
} from "lucide-react";
import { PlatformPreviewFrame } from "@/components/campaigns/platform-preview-frame";
import { ReferenceImageUpload, type ReferenceImageData } from "@/components/reference-image-upload";
import { TemplateModeToggle } from "@/components/templates/template-mode-toggle";
import { TemplateSelector } from "@/components/templates/template-selector";
import { TemplateCustomizer } from "@/components/templates/template-customizer";
import type { ContentTemplate, TemplateRenderResponse } from "@/types/templates";

const PLATFORM_OPTIONS = [
  { value: "instagram_feed",   labelKey: "formatFeed",       ratio: "4:5",  platform: "instagram" },
  { value: "instagram_square", labelKey: "formatSquare",     ratio: "1:1",  platform: "instagram" },
  { value: "instagram_story",  labelKey: "formatStoryReel",  ratio: "9:16", platform: "instagram" },
  { value: "twitter",          labelKey: "formatLandscape",  ratio: "16:9", platform: "twitter"   },
  { value: "twitter_square",   labelKey: "formatSquare",     ratio: "1:1",  platform: "twitter"   },
  { value: "facebook_feed",    labelKey: "formatFeed",       ratio: "4:5",  platform: "facebook"  },
  { value: "facebook_square",  labelKey: "formatSquare",     ratio: "1:1",  platform: "facebook"  },
  { value: "facebook_landscape",labelKey: "formatLandscape", ratio: "16:9", platform: "facebook"  },
  { value: "tiktok",           labelKey: "formatVertical",   ratio: "9:16", platform: "tiktok"    },
  { value: "linkedin",         labelKey: "formatSquare",     ratio: "1:1",  platform: "linkedin"  },
  { value: "linkedin_landscape",labelKey: "formatLandscape", ratio: "16:9", platform: "linkedin"  },
];

const PLATFORM_META_KEYS: Record<string, { nameKey: string; color: string }> = {
  instagram: { nameKey: "platformInstagram", color: "text-pink-500" },
  twitter:   { nameKey: "platformTwitter", color: "text-foreground" },
  facebook:  { nameKey: "platformFacebook", color: "text-blue-600" },
  tiktok:    { nameKey: "platformTikTok", color: "text-foreground" },
  linkedin:  { nameKey: "platformLinkedIn", color: "text-blue-600" },
};

function PlatformSvg({ platform, className = "h-4 w-4" }: { platform: string; className?: string }) {
  switch (platform) {
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      );
    case "twitter":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48v-7.1A8.16 8.16 0 0019.59 14V10.5a8.16 8.16 0 01-3.77-1.08V6.69h3.77z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    default:
      return null;
  }
}

const MODEL_OPTIONS = [
  { value: "nb2", label: "Nano Banana 2 (Fast · 4K)", description: "Gemini 3.1 Flash Image — best for most use cases" },
  { value: "pro", label: "Pro (Max Quality · 4K)",   description: "Gemini 3 Pro Image — highest reasoning, slower" },
];

// Aspect ratio → CSS aspect-ratio class for preview
const RATIO_CLASS: Record<string, string> = {
  "4:5":  "aspect-[4/5]",
  "1:1":  "aspect-square",
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
};

export default function CreativeDesignerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const t = useTranslations("creativeDesigner");
  const prefillContent = searchParams.get("content") ?? "";

  // Resolve translated platform names and format labels
  const PLATFORM_META = Object.fromEntries(
    Object.entries(PLATFORM_META_KEYS).map(([key, meta]) => [
      key,
      { name: t(meta.nameKey), color: meta.color },
    ])
  );
  const resolvedPlatformOptions = PLATFORM_OPTIONS.map((p) => ({
    ...p,
    label: t(p.labelKey),
  }));

  // Mode toggle: freeform vs template (default)
  const [mode, setMode] = useState<"freeform" | "template">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<ContentTemplate | null>(null);

  // Freeform state
  const [postContent, setPostContent] = useState(prefillContent);
  const [platform, setPlatform] = useState("instagram_feed");
  const [model, setModel] = useState("nb2");
  const [customInstruction, setCustomInstruction] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    imageUrl: string;
    campaignId: string;
    aspectRatio: string;
    prompt: string;
  } | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [referenceImage, setReferenceImage] = useState<ReferenceImageData | null>(null);

  const selectedPlatform = resolvedPlatformOptions.find((p) => p.value === platform);
  const ratioClass = RATIO_CLASS[selectedPlatform?.ratio ?? "1:1"] ?? "aspect-square";

  async function generate() {
    if (!postContent.trim()) return;
    setGenerating(true);
    setError("");
    setResult(null);

    const res = await fetch("/api/skills/creative-designer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        postContent,
        platform,
        modelTier: model,
        customInstruction: customInstruction.trim() || undefined,
        referenceImage: referenceImage
          ? { base64: referenceImage.base64, mimeType: referenceImage.mimeType }
          : undefined,
      }),
    });

    const data = await res.json();
    setGenerating(false);

    if (!res.ok) {
      setError(data.error || t("generationFailed"));
      return;
    }

    setResult(data);
  }

  async function downloadImage() {
    if (!result?.imageUrl) return;
    const a = document.createElement("a");
    a.href = result.imageUrl;
    a.download = `marketpilot-${platform}-${Date.now()}.png`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/${projectId}/skills`}>
            <ArrowLeft className="me-2 h-4 w-4" />
            {t("backToSkills")}
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-500/10">
            <ImageIcon className="h-5 w-5 text-pink-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>
        </div>
        <TemplateModeToggle mode={mode} onModeChange={(m) => { setMode(m); setSelectedTemplate(null); }} />
      </div>

      {/* ─── Template Mode ─────────────────────────────────────────── */}
      {mode === "template" && !selectedTemplate && (
        <TemplateSelector onSelect={setSelectedTemplate} />
      )}

      {mode === "template" && selectedTemplate && (
        <TemplateCustomizer
          template={selectedTemplate}
          projectId={projectId}
          platformOptions={resolvedPlatformOptions}
          platformMeta={PLATFORM_META}
          PlatformSvg={PlatformSvg}
          ratioClassMap={RATIO_CLASS}
          onBack={() => setSelectedTemplate(null)}
          onResult={() => {}}
        />
      )}

      {/* ─── Freeform Mode ─────────────────────────────────────────── */}
      {mode === "freeform" && <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Config */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("contentAndPlatform")}</CardTitle>
              <CardDescription>
                {t("contentAndPlatformDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="content">{t("postCopy")}</Label>
                <Textarea
                  id="content"
                  placeholder={t("postCopyPlaceholder")}
                  rows={4}
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="platform">{t("platformAndFormat")}</Label>
                <Select value={platform} onValueChange={(val) => val && setPlatform(val)}>
                  <SelectTrigger id="platform">
                    <SelectValue>
                      {selectedPlatform && (
                        <span className="flex items-center gap-2">
                          <PlatformSvg platform={selectedPlatform.platform} className={`h-4 w-4 ${PLATFORM_META[selectedPlatform.platform]?.color}`} />
                          <span>{PLATFORM_META[selectedPlatform.platform]?.name} — {selectedPlatform.label}</span>
                          <span className="text-muted-foreground text-xs ms-1">({selectedPlatform.ratio})</span>
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(PLATFORM_META).map((platformKey) => {
                      const meta = PLATFORM_META[platformKey];
                      const opts = resolvedPlatformOptions.filter((p) => p.platform === platformKey);
                      if (opts.length === 0) return null;
                      return (
                        <div key={platformKey}>
                          <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            <PlatformSvg platform={platformKey} className={`h-3.5 w-3.5 ${meta.color}`} />
                            {meta.name}
                          </div>
                          {opts.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              <span className="flex items-center gap-2">
                                <span>{p.label}</span>
                                <span className="text-muted-foreground text-xs">({p.ratio})</span>
                              </span>
                            </SelectItem>
                          ))}
                        </div>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="model">{t("imageModel")}</Label>
                <Select value={model} onValueChange={(val) => val && setModel(val)}>
                  <SelectTrigger id="model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        <div>
                          <p className="font-medium">{m.label}</p>
                          <p className="text-xs text-muted-foreground">{m.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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

              <div className="space-y-1.5">
                <Label htmlFor="custom">
                  {t("styleDirection")}
                  <span className="ms-1 text-muted-foreground font-normal">{t("optional")}</span>
                </Label>
                <Textarea
                  id="custom"
                  placeholder={t("styleDirectionPlaceholder")}
                  rows={2}
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("styleDirectionHint")}
                </p>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                onClick={generate}
                disabled={generating || !postContent.trim()}
                className="w-full"
              >
                {generating ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t("generatingImage")}
                  </>
                ) : (
                  <>
                    <Sparkles className="me-2 h-4 w-4" />
                    {t("generateVisual")}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Output */}
        <div className="space-y-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {t("output")}
                {selectedPlatform && (
                  <Badge variant="secondary" className="text-xs font-mono">
                    {selectedPlatform.ratio}
                  </Badge>
                )}
                {result && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ms-auto h-7 text-xs gap-1.5"
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showPreview ? t("rawImage") : t("platformPreview")}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {generating ? (
                <div className={`${ratioClass} w-full max-w-sm mx-auto rounded-lg bg-muted flex flex-col items-center justify-center gap-3`}>
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {t("generatingWithNanoBanana")}
                  </p>
                </div>
              ) : result ? (
                <div className="space-y-3">
                  {showPreview ? (
                    <PlatformPreviewFrame
                      platform={platform}
                      imageUrl={result.imageUrl}
                      ratioClass={ratioClass}
                    />
                  ) : (
                    <div className={`${ratioClass} w-full max-w-sm mx-auto rounded-lg overflow-hidden border bg-muted relative`}>
                      <Image
                        src={result.imageUrl}
                        alt="Generated visual"
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadImage}
                      className="flex-1"
                    >
                      <Download className="me-2 h-4 w-4" />
                      {t("download")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generate}
                      className="flex-1"
                    >
                      <RefreshCw className="me-2 h-4 w-4" />
                      {t("regenerate")}
                    </Button>
                    <Button
                      size="sm"
                      asChild
                      className="flex-1"
                    >
                      <Link href={`/dashboard/${projectId}/campaigns/${result.campaignId}`}>
                        <Send className="me-2 h-4 w-4" />
                        {t("viewCampaign")}
                      </Link>
                    </Button>
                  </div>
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground">
                      {t("viewPromptUsed")}
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap font-sans bg-muted rounded p-2 leading-relaxed">
                      {result.prompt}
                    </pre>
                  </details>
                </div>
              ) : (
                <PlatformPreviewFrame
                  platform={platform}
                  imageUrl={null}
                  ratioClass={ratioClass}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>}
    </div>
  );
}
