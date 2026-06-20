import type {
  SocialPlatformClient,
  PlatformPublishResult,
  PlatformComment,
} from "./index";

export class TikTokClient implements SocialPlatformClient {
  platform = "tiktok" as const;

  private baseUrl = "https://open.tiktokapis.com/v2";

  private async request(
    path: string,
    accessToken: string,
    options: RequestInit = {}
  ) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`TikTok API error (${res.status}): ${error}`);
    }

    return res.json();
  }

  async publishText(
    accessToken: string,
    text: string
  ): Promise<PlatformPublishResult> {
    // TikTok requires video content
    throw new Error("TikTok requires video content. Text-only posts are not supported.");
  }

  async publishMedia(
    accessToken: string,
    caption: string,
    mediaUrls: string[]
  ): Promise<PlatformPublishResult> {
    // Step 1: Initialize video upload
    const initData = await this.request(
      "/post/publish/video/init/",
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          post_info: {
            title: caption,
            // PUBLIC so posts are actually visible (requires app approval +
            // the video.publish scope, which grants public posting).
            privacy_level: "PUBLIC",
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
          },
          source_info: {
            source: "PULL_FROM_URL",
            video_url: mediaUrls[0],
          },
        }),
      }
    );

    const publishId = initData.data?.publish_id;
    if (!publishId) {
      throw new Error("Failed to initialize TikTok upload");
    }

    // Step 2: Check publish status (TikTok processes asynchronously)
    let status = "PROCESSING_UPLOAD";
    let attempts = 0;
    let videoId = "";

    while (status === "PROCESSING_UPLOAD" && attempts < 15) {
      await new Promise((r) => setTimeout(r, 3000));

      const statusData = await this.request(
        "/post/publish/status/fetch/",
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({ publish_id: publishId }),
        }
      );

      status = statusData.data?.status;
      if (status === "PUBLISH_COMPLETE") {
        videoId = statusData.data?.publicaly_available_post_id?.[0] || publishId;
      }
      attempts++;
    }

    if (status !== "PUBLISH_COMPLETE") {
      // Return publish_id for retry
      return {
        platformPostId: publishId,
        platformPostUrl: "",
      };
    }

    return {
      platformPostId: videoId,
      platformPostUrl: `https://www.tiktok.com/@user/video/${videoId}`,
    };
  }

  async getComments(
    accessToken: string,
    postId: string,
    sinceId?: string
  ): Promise<PlatformComment[]> {
    const data = await this.request("/comment/list/", accessToken, {
      method: "POST",
      body: JSON.stringify({
        video_id: postId,
        max_count: 50,
        cursor: sinceId ? parseInt(sinceId) : 0,
      }),
    });

    if (!data.data?.comments) return [];

    return data.data.comments.map(
      (comment: { id: string; text: string; user: { display_name: string }; create_time: number }) => ({
        id: comment.id,
        text: comment.text,
        author: comment.user?.display_name || "unknown",
        createdAt: new Date(comment.create_time * 1000).toISOString(),
        postId,
      })
    );
  }

  async replyToComment(
    accessToken: string,
    commentId: string,
    text: string
  ): Promise<string> {
    const data = await this.request("/comment/reply/", accessToken, {
      method: "POST",
      body: JSON.stringify({
        comment_id: commentId,
        text,
      }),
    });

    return data.data?.comment_id || commentId;
  }

  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
  }> {
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      throw new Error(`TikTok token refresh failed: ${await res.text()}`);
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async getUserProfile(accessToken: string) {
    const data = await this.request(
      "/user/info/?fields=open_id,display_name,avatar_url,username",
      accessToken
    );

    const user = data.data?.user;
    return {
      id: user?.open_id || "",
      username: user?.username || "",
      displayName: user?.display_name || "",
      avatarUrl: user?.avatar_url || "",
    };
  }
}
