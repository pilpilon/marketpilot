"use client";

import React from "react";
import Image from "next/image";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Share2, ThumbsUp, Repeat2 } from "lucide-react";

function InstagramFrame({ children, username }: { children: React.ReactNode; username?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="h-8 w-8 rounded-full primary-gradient flex items-center justify-center text-white text-xs font-bold">
          MP
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-900 truncate">{username || "your_brand"}</p>
          <p className="text-[10px] text-gray-500">Sponsored</p>
        </div>
        <MoreHorizontal className="h-4 w-4 text-gray-500" />
      </div>
      {/* Image */}
      <div className="relative">{children}</div>
      {/* Actions */}
      <div className="px-3 py-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Heart className="h-5 w-5 text-gray-800" />
            <MessageCircle className="h-5 w-5 text-gray-800" />
            <Send className="h-5 w-5 text-gray-800" />
          </div>
          <Bookmark className="h-5 w-5 text-gray-800" />
        </div>
        <p className="text-xs font-semibold text-gray-900">128 likes</p>
        <p className="text-xs text-gray-500 line-clamp-2">
          <span className="font-semibold text-gray-900">{username || "your_brand"}</span>{" "}
          Your caption will appear here...
        </p>
      </div>
    </div>
  );
}

function TwitterFrame({ children, username }: { children: React.ReactNode; username?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-start gap-2.5 px-3 pt-3">
        <div className="h-9 w-9 rounded-full primary-gradient flex items-center justify-center text-white text-xs font-bold shrink-0">
          MP
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-sm font-bold text-gray-900 truncate">Your Brand</p>
            <p className="text-sm text-gray-500 truncate">@{username || "your_brand"}</p>
          </div>
          <p className="text-sm text-gray-800 mt-0.5 line-clamp-2">Your post copy will appear here...</p>
        </div>
      </div>
      {/* Image */}
      <div className="mx-3 mt-2.5 rounded-xl overflow-hidden border border-gray-200">
        {children}
      </div>
      {/* Actions */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-1 text-gray-500">
          <MessageCircle className="h-4 w-4" />
          <span className="text-xs">24</span>
        </div>
        <div className="flex items-center gap-1 text-gray-500">
          <Repeat2 className="h-4 w-4" />
          <span className="text-xs">12</span>
        </div>
        <div className="flex items-center gap-1 text-gray-500">
          <Heart className="h-4 w-4" />
          <span className="text-xs">128</span>
        </div>
        <div className="flex items-center gap-1 text-gray-500">
          <Share2 className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function TikTokFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-black rounded-xl overflow-hidden max-w-[280px] mx-auto relative">
      {/* Image fills the frame */}
      <div className="relative">{children}</div>
      {/* Right-side action buttons overlay */}
      <div className="absolute right-2 bottom-16 flex flex-col items-center gap-4">
        {[Heart, MessageCircle, Bookmark, Share2].map((Icon, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div className="h-9 w-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Icon className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-[10px] text-white/80">{["4.2K", "89", "1.2K", "Share"][i]}</span>
          </div>
        ))}
      </div>
      {/* Bottom caption overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
        <p className="text-xs font-semibold text-white">@your_brand</p>
        <p className="text-[11px] text-white/80 mt-0.5 line-clamp-2">Your caption here... #fyp</p>
      </div>
    </div>
  );
}

function LinkedInFrame({ children, username }: { children: React.ReactNode; username?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <div className="h-10 w-10 rounded-full primary-gradient flex items-center justify-center text-white text-xs font-bold shrink-0">
          MP
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{username || "Your Brand"}</p>
          <p className="text-[11px] text-gray-500">1,234 followers · 2h</p>
        </div>
        <MoreHorizontal className="h-4 w-4 text-gray-500" />
      </div>
      {/* Caption */}
      <div className="px-3 pb-2">
        <p className="text-xs text-gray-700 line-clamp-2">Your post copy will appear here...</p>
      </div>
      {/* Image */}
      <div className="relative">{children}</div>
      {/* Actions */}
      <div className="flex items-center justify-around px-3 py-2 border-t border-gray-100">
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageCircle, label: "Comment" },
          { icon: Repeat2, label: "Repost" },
          { icon: Send, label: "Send" },
        ].map(({ icon: Icon, label }) => (
          <button key={label} className="flex items-center gap-1.5 text-gray-500 py-1">
            <Icon className="h-4 w-4" />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function PlatformPreviewFrame({
  platform,
  imageUrl,
  ratioClass,
  username,
  children,
}: {
  platform: string;
  imageUrl?: string | null;
  ratioClass: string;
  username?: string;
  children?: React.ReactNode;
}) {
  const imageElement = children ? (
    <>{children}</>
  ) : imageUrl ? (
    <div className={`${ratioClass} w-full relative`}>
      <Image src={imageUrl} alt="Generated visual" fill className="object-cover" />
    </div>
  ) : (
    <div className={`${ratioClass} w-full bg-gray-100 flex items-center justify-center`}>
      <p className="text-xs text-gray-400">Image preview</p>
    </div>
  );

  // Determine which frame to use based on platform key
  const platformBase = platform.split("_")[0];

  switch (platformBase) {
    case "instagram":
      return <InstagramFrame username={username}>{imageElement}</InstagramFrame>;
    case "twitter":
      return <TwitterFrame username={username}>{imageElement}</TwitterFrame>;
    case "tiktok":
      return <TikTokFrame>{imageElement}</TikTokFrame>;
    case "linkedin":
      return <LinkedInFrame username={username}>{imageElement}</LinkedInFrame>;
    default:
      return <div className="max-w-sm mx-auto">{imageElement}</div>;
  }
}
