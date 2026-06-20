"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PlatformIcon } from "@/components/social/platform-icon";
import { PlatformPreview } from "./platform-preview";
import { AiAssistPanel } from "./ai-assist-panel";
import { toast } from "sonner";
import {
  Send,
  Clock,
  Save,
  Sparkles,
  Loader2,
  ImageIcon,
  Link2,
  Upload,
  X,
  Video,
  Plus,
} from "lucide-react";
import type { Database, Platform } from "@/types/database";

type SocialAccount = Database["public"]["Tables"]["social_accounts"]["Row"];

const CHAR_LIMITS: Record<Platform, number> = {
  twitter: 280,
  instagram: 2200,
  facebook: 63206,
  tiktok: 2200,
  linkedin: 3000,
};

const MAX_MEDIA = 10;

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".avi"];

function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase().split("?")[0];
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

interface ComposeEditorProps {
  projectId: string;
  accounts: SocialAccount[];
  initialCaption?: string;
  initialHashtags?: string[];
  initialMediaUrls?: string[];
  campaignId?: string;
}

export function ComposeEditor({
  projectId,
  accounts,
  initialCaption,
  initialHashtags,
  initialMediaUrls,
  campaignId,
}: ComposeEditorProps) {
  const [caption, setCaption] = useState(initialCaption || "");
  const [hashtags, setHashtags] = useState<string[]>(initialHashtags || []);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [scheduledAt, setScheduledAt] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<string[]>(initialMediaUrls || []);
  const [urlInput, setUrlInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const selectedPlatforms = accounts.filter((a) => selectedAccounts.has(a.id));

  function toggleAccount(accountId: string) {
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  }

  // ── Media management ──────────────────────────────────────────

  function addMediaUrl(url: string) {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (mediaUrls.includes(trimmed)) {
      toast.error("This URL is already added");
      return;
    }
    if (mediaUrls.length >= MAX_MEDIA) {
      toast.error(`Maximum ${MAX_MEDIA} media items allowed`);
      return;
    }
    setMediaUrls([...mediaUrls, trimmed]);
    setUrlInput("");
  }

  function removeMedia(index: number) {
    setMediaUrls(mediaUrls.filter((_, i) => i !== index));
  }

  async function handleUploadFile(file: File) {
    if (mediaUrls.length >= MAX_MEDIA) {
      toast.error(`Maximum ${MAX_MEDIA} media items allowed`);
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      const data = await res.json();
      setMediaUrls((prev) => [...prev, data.url]);
      toast.success("File uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      // Upload files up to the limit
      const remaining = MAX_MEDIA - mediaUrls.length;
      const toUpload = files.slice(0, remaining);
      if (files.length > remaining) {
        toast.warning(`Only ${remaining} files added (max ${MAX_MEDIA})`);
      }
      toUpload.forEach((file) => handleUploadFile(file));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mediaUrls.length]
  );

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => handleUploadFile(file));
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // ── Publishing ────────────────────────────────────────────────

  async function handlePublish(mode: "now" | "schedule" | "draft") {
    if (selectedAccounts.size === 0) {
      toast.error("Select at least one platform");
      return;
    }

    if (!caption.trim()) {
      toast.error("Write some content first");
      return;
    }

    if (mode === "schedule" && !scheduledAt) {
      toast.error("Pick a date and time for scheduling");
      return;
    }

    setIsPublishing(true);

    try {
      const status = mode === "draft" ? "draft" : mode === "schedule" ? "scheduled" : "draft";

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          campaignId: campaignId || undefined,
          status,
          scheduledAt: mode === "schedule" ? new Date(scheduledAt).toISOString() : undefined,
          platforms: selectedPlatforms.map((a) => ({
            socialAccountId: a.id,
            platform: a.platform,
            caption,
            hashtags,
            mediaUrls,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create post");
      }

      const post = await res.json();

      // If "Post Now", trigger immediate publish
      if (mode === "now") {
        const publishRes = await fetch(`/api/posts/${post.id}/publish`, {
          method: "POST",
        });

        const publishResult = await publishRes.json();

        if (!publishRes.ok || !publishResult.success) {
          const failedPlatforms = publishResult.results
            ?.filter((r: { success: boolean }) => !r.success)
            .map((r: { platform: string; error?: string }) => `${r.platform}: ${r.error || "unknown error"}`)
            .join("; ");
          toast.error(failedPlatforms || "Publishing failed. Check your posts page.");
        } else {
          toast.success("Published successfully!");
          router.push(`/dashboard/${projectId}/campaigns`);
        }
      } else if (mode === "schedule") {
        toast.success("Post scheduled!");
      } else {
        toast.success("Draft saved!");
      }

      // Reset form
      setCaption("");
      setHashtags([]);
      setSelectedAccounts(new Set());
      setScheduledAt("");
      setMediaUrls([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      {/* Editor Column */}
      <div className="space-y-4">
        {/* Platform selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Platforms</CardTitle>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No connected accounts.{" "}
                <a
                  href={`/dashboard/${projectId}/social`}
                  className="text-primary underline"
                >
                  Connect one
                </a>
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {accounts.map((account) => (
                  <label
                    key={account.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedAccounts.has(account.id)}
                      onCheckedChange={() => toggleAccount(account.id)}
                    />
                    <PlatformIcon
                      platform={account.platform}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">
                      @{account.platform_username}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Media input section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Media {mediaUrls.length > 0 && `(${mediaUrls.length}/${MAX_MEDIA})`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Existing media thumbnails */}
            {mediaUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {mediaUrls.map((url, index) => (
                  <div
                    key={url}
                    className="relative group h-20 w-20 shrink-0 rounded-lg overflow-hidden border bg-muted"
                  >
                    {isVideoUrl(url) ? (
                      <div className="flex h-full w-full items-center justify-center bg-muted">
                        <Video className="h-6 w-6 text-muted-foreground" />
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={`Media ${index + 1}`}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          // If image fails to load, show a generic icon
                          const target = e.currentTarget;
                          target.style.display = "none";
                          const parent = target.parentElement;
                          if (parent) {
                            parent.classList.add("flex", "items-center", "justify-center");
                            const icon = document.createElement("div");
                            icon.className = "text-muted-foreground";
                            icon.innerHTML = "&#x1F5BC;";
                            parent.appendChild(icon);
                          }
                        }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(index)}
                      className="absolute top-0.5 right-0.5 rounded-full bg-black/60 text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove media"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Drag-and-drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-4 cursor-pointer transition-colors ${
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
            >
              {isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-5 w-5 text-muted-foreground" />
              )}
              <p className="text-xs text-muted-foreground text-center">
                {isUploading
                  ? "Uploading..."
                  : "Drag & drop or click to upload"}
              </p>
              <p className="text-xs text-muted-foreground/70">
                Images (JPG, PNG, GIF, WebP) and videos (MP4, MOV, WebM) up to 50MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Paste URL field */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="url"
                  placeholder="Paste image or video URL..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addMediaUrl(urlInput);
                    }
                  }}
                  className="pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addMediaUrl(urlInput)}
                disabled={!urlInput.trim() || mediaUrls.length >= MAX_MEDIA}
              >
                <Plus className="h-4 w-4 me-1" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Caption editor */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Content</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAiPanel(!showAiPanel)}
            >
              <Sparkles className="me-1 h-4 w-4" />
              AI Assist
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="What's on your mind?"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={6}
              className="resize-none"
            />
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {selectedPlatforms.map((a) => {
                  const limit = CHAR_LIMITS[a.platform];
                  const over = caption.length > limit;
                  return (
                    <Badge
                      key={a.id}
                      variant={over ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      <PlatformIcon
                        platform={a.platform}
                        className="h-3 w-3 me-1"
                      />
                      {caption.length}/{limit}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Hashtags */}
            <div>
              <input
                type="text"
                placeholder="Add hashtags (press Enter)"
                className="w-full rounded-md border px-3 py-2 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const value = e.currentTarget.value.trim().replace(/^#/, "");
                    if (value && !hashtags.includes(value)) {
                      setHashtags([...hashtags, value]);
                    }
                    e.currentTarget.value = "";
                  }
                }}
              />
              {hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {hashtags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() =>
                        setHashtags(hashtags.filter((t) => t !== tag))
                      }
                    >
                      #{tag} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Assist Panel */}
        {showAiPanel && (
          <AiAssistPanel
            projectId={projectId}
            onCaptionGenerated={setCaption}
            onHashtagsGenerated={(tags) =>
              setHashtags((prev) => [...new Set([...prev, ...tags])])
            }
          />
        )}

        {/* Schedule & Action buttons */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="rounded-md border px-3 py-2 text-sm flex-1"
                />
              </div>
              <Separator />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handlePublish("draft")}
                  disabled={isPublishing}
                >
                  <Save className="me-2 h-4 w-4" />
                  Save Draft
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handlePublish("schedule")}
                  disabled={isPublishing || !scheduledAt}
                >
                  <Clock className="me-2 h-4 w-4" />
                  Schedule
                </Button>
                <Button
                  onClick={() => handlePublish("now")}
                  disabled={isPublishing}
                >
                  {isPublishing ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="me-2 h-4 w-4" />
                  )}
                  Post Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Column */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground">
          Preview
        </h3>
        {selectedPlatforms.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Select platforms to see previews
          </p>
        ) : (
          selectedPlatforms.map((account) => (
            <PlatformPreview
              key={account.id}
              platform={account.platform}
              username={account.platform_username || "user"}
              avatarUrl={account.platform_avatar_url || ""}
              caption={caption}
              hashtags={hashtags}
              mediaUrls={mediaUrls}
            />
          ))
        )}
      </div>
    </div>
  );
}
