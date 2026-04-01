import type { Platform } from "@/types/database";
import { TwitterClient } from "./twitter";
import { InstagramClient } from "./instagram";
import { TikTokClient } from "./tiktok";
import { FacebookClient } from "./facebook";

export interface PlatformPublishResult {
  platformPostId: string;
  platformPostUrl: string;
}

export interface PlatformComment {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  postId: string;
}

export interface SocialPlatformClient {
  platform: Platform;
  publishText(accessToken: string, text: string): Promise<PlatformPublishResult>;
  publishMedia(
    accessToken: string,
    text: string,
    mediaUrls: string[],
    platformUserId?: string
  ): Promise<PlatformPublishResult>;
  getComments(
    accessToken: string,
    postId: string,
    sinceId?: string
  ): Promise<PlatformComment[]>;
  replyToComment(
    accessToken: string,
    commentId: string,
    text: string
  ): Promise<string>;
  refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
  }>;
  getUserProfile(accessToken: string): Promise<{
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
  }>;
}

const clients: Record<Platform, SocialPlatformClient> = {
  twitter: new TwitterClient(),
  instagram: new InstagramClient(),
  tiktok: new TikTokClient(),
  facebook: new FacebookClient(),
};

export function getPlatformClient(platform: Platform): SocialPlatformClient {
  return clients[platform];
}

export { TwitterClient, InstagramClient, TikTokClient, FacebookClient };
