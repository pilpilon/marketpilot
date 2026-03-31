"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PlatformIcon } from "@/components/social/platform-icon";
import { PlatformPreview } from "./platform-preview";
import { AiAssistPanel } from "./ai-assist-panel";
import Image from "next/image";
import { Send, Clock, Save, Sparkles, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import type { Database, Platform } from "@/types/database";

type SocialAccount = Database["public"]["Tables"]["social_accounts"]["Row"];

const CHAR_LIMITS: Record<Platform, number> = {
  twitter: 280,
  instagram: 2200,
  tiktok: 2200,
};

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
            mediaUrls: initialMediaUrls || [],
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

        if (!publishRes.ok) {
          toast.error("Post created but publishing failed. Check your posts page.");
        } else {
          toast.success("Published successfully!");
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

        {/* Attached media */}
        {initialMediaUrls && initialMediaUrls.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Media ({initialMediaUrls.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 overflow-x-auto">
                {initialMediaUrls.map((url) => (
                  <div
                    key={url}
                    className="relative h-20 w-20 shrink-0 rounded-lg overflow-hidden border bg-muted"
                  >
                    <Image
                      src={url}
                      alt="Attached media"
                      fill
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Caption editor */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Content</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAiPanel(!showAiPanel)}
            >
              <Sparkles className="mr-1 h-4 w-4" />
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
                        className="h-3 w-3 mr-1"
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
                  <Save className="mr-2 h-4 w-4" />
                  Save Draft
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handlePublish("schedule")}
                  disabled={isPublishing || !scheduledAt}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Schedule
                </Button>
                <Button
                  onClick={() => handlePublish("now")}
                  disabled={isPublishing}
                >
                  {isPublishing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
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
              mediaUrls={initialMediaUrls}
            />
          ))
        )}
      </div>
    </div>
  );
}
