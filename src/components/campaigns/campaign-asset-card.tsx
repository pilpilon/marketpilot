"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, ChevronDown, ChevronUp, Send, Check, Download, ImageIcon, Play } from "lucide-react";

type Asset = {
  id: string;
  title: string | null;
  content: string | null;
  storage_path: string | null;
  asset_type: string;
  status: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

const ASSET_TYPE_LABELS: Record<string, string> = {
  post_draft: "Post Draft",
  image: "Image",
  video: "Video",
  video_script: "Video Script",
  scene_json: "Scene",
  content_calendar: "Content Calendar",
  strategy_doc: "Strategy Doc",
};

export function CampaignAssetCard({
  asset,
  projectId,
}: {
  asset: Asset;
  projectId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [captionCopied, setCaptionCopied] = useState(false);

  const meta = asset.metadata as Record<string, unknown> | undefined;
  const caption = meta?.caption as string | undefined;
  const hashtags = meta?.hashtags as string[] | undefined;
  const aspectRatio = meta?.aspect_ratio as string | undefined; // e.g. "4:5", "1:1", "16:9"

  const content = asset.content || "";
  const preview = content.slice(0, 200);
  const isLong = content.length > 200;

  async function copyContent() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm">
              {asset.title || ASSET_TYPE_LABELS[asset.asset_type] || asset.asset_type}
            </p>
            <Badge variant="outline" className="text-xs">
              {ASSET_TYPE_LABELS[asset.asset_type] || asset.asset_type}
            </Badge>
            <Badge
              variant={asset.status === "approved" ? "default" : "secondary"}
              className="text-xs"
            >
              {asset.status}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(asset.asset_type === "image" || asset.asset_type === "template_render" || asset.asset_type === "video") && asset.storage_path ? (
            <Button variant="ghost" size="sm" asChild className="h-8 px-2">
              <a href={asset.storage_path} download target="_blank" rel="noreferrer">
                <Download className="h-4 w-4" />
              </a>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={copyContent}
              className="h-8 px-2"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          )}
          {asset.asset_type === "post_draft" && (
            <>
              <Button variant="ghost" size="sm" asChild className="h-8 px-2" title="Generate visual">
                <Link
                  href={`/dashboard/${projectId}/skills/creative-designer?content=${encodeURIComponent(content.slice(0, 1000))}`}
                >
                  <ImageIcon className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild className="h-8 px-2" title="Send to composer">
                <Link
                  href={`/dashboard/${projectId}/compose?content=${encodeURIComponent(content.slice(0, 500))}`}
                >
                  <Send className="h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {asset.asset_type === "video" && asset.storage_path ? (
          <div className="space-y-3">
            <div className="relative w-full max-w-sm rounded-lg overflow-hidden border bg-black"
              style={{ aspectRatio: aspectRatio?.replace(":", "/") || "9/16" }}
            >
              <video
                controls
                playsInline
                src={asset.storage_path}
                className="w-full h-full object-contain"
              />
            </div>
            {meta?.duration_seconds ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Play className="h-3 w-3" />
                {String(meta.duration_seconds)}s
                {meta.cost_usd ? ` · $${Number(meta.cost_usd as number).toFixed(2)}` : ""}
              </p>
            ) : null}
            {content && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">View script</summary>
                <pre className="mt-1 whitespace-pre-wrap font-sans bg-muted rounded p-2 leading-relaxed">
                  {content}
                </pre>
              </details>
            )}
          </div>
        ) : (asset.asset_type === "image" || asset.asset_type === "template_render") && asset.storage_path ? (
          <div className="space-y-3">
            <div
              className="relative w-full max-w-xs rounded-lg overflow-hidden border bg-muted"
              style={{ aspectRatio: aspectRatio?.replace(":", "/") || "1/1" }}
            >
              <Image
                src={asset.storage_path}
                alt={asset.title || "Generated image"}
                fill
                className="object-contain"
              />
            </div>
            {caption && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Caption</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={async () => {
                      const full = hashtags?.length
                        ? `${caption}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`
                        : caption;
                      await navigator.clipboard.writeText(full);
                      setCaptionCopied(true);
                      setTimeout(() => setCaptionCopied(false), 2000);
                    }}
                  >
                    {captionCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    <span className="ms-1">{captionCopied ? "Copied" : "Copy"}</span>
                  </Button>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{caption}</p>
                </div>
                {hashtags && hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {hashtags.map((h) => (
                      <span
                        key={h}
                        className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                      >
                        #{h}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {content && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">View prompt</summary>
                <pre className="mt-1 whitespace-pre-wrap font-sans bg-muted rounded p-2 leading-relaxed">
                  {content}
                </pre>
              </details>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-md bg-muted/50 p-3">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                {expanded ? content : preview}
                {!expanded && isLong && (
                  <span className="text-muted-foreground">…</span>
                )}
              </pre>
            </div>
            {isLong && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    Show full content
                  </>
                )}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
