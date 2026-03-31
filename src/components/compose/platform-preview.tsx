"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlatformIcon } from "@/components/social/platform-icon";
import type { Platform } from "@/types/database";

interface PlatformPreviewProps {
  platform: Platform;
  username: string;
  avatarUrl: string;
  caption: string;
  hashtags: string[];
  mediaUrls?: string[];
}

const PLATFORM_NAMES: Record<Platform, string> = {
  twitter: "X",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
};

export function PlatformPreview({
  platform,
  username,
  avatarUrl,
  caption,
  hashtags,
  mediaUrls,
}: PlatformPreviewProps) {
  const fullText = hashtags.length > 0
    ? `${caption}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`
    : caption;

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center gap-2">
        <PlatformIcon platform={platform} className="h-4 w-4" />
        <span className="text-sm font-medium">{PLATFORM_NAMES[platform]}</span>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback>{username[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">@{username}</p>
              <p className="text-xs text-muted-foreground">Just now</p>
            </div>
          </div>
          {mediaUrls && mediaUrls.length > 0 && (
            <div className="rounded-md overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrls[0]}
                alt="Post media"
                className="w-full object-cover"
              />
            </div>
          )}
          <p className="text-sm whitespace-pre-wrap break-words">
            {fullText || (
              <span className="text-muted-foreground italic">
                Your content will appear here...
              </span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
