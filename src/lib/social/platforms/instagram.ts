import type {
  SocialPlatformClient,
  PlatformPublishResult,
  PlatformComment,
} from "./index";

export class InstagramClient implements SocialPlatformClient {
  platform = "instagram" as const;

  // Instagram Business Login uses the Facebook Graph API
  private graphUrl = "https://graph.facebook.com/v22.0";

  private async request(path: string, accessToken: string, options: RequestInit = {}) {
    const separator = path.includes("?") ? "&" : "?";
    const url = `${this.graphUrl}${path}${separator}access_token=${accessToken}`;

    const headers: Record<string, string> = {};
    // Only set Content-Type for non-GET requests
    if (options.method && options.method !== "GET") {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers as Record<string, string> },
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Instagram API error (${res.status}): ${error}`);
    }

    return res.json();
  }

  async publishText(
    accessToken: string,
    text: string
  ): Promise<PlatformPublishResult> {
    // Instagram requires media - text-only posts are not supported
    throw new Error("Instagram requires media content. Text-only posts are not supported.");
  }

  async publishMedia(
    accessToken: string,
    caption: string,
    mediaUrls: string[]
  ): Promise<PlatformPublishResult> {
    // Step 1: Get the Instagram user ID
    const profile = await this.request("/me?fields=user_id", accessToken);
    const igAccountId = profile.user_id || profile.id;
    if (!igAccountId) {
      throw new Error("Could not get Instagram user ID");
    }

    // Step 2: Create media container (uses Instagram Graph API)
    const igGraphUrl = `https://graph.instagram.com/v22.0/${igAccountId}/media?access_token=${accessToken}`;
    const containerRes = await fetch(igGraphUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: mediaUrls[0],
        caption,
      }),
    });

    if (!containerRes.ok) {
      throw new Error(`Instagram media create failed: ${await containerRes.text()}`);
    }

    const container = await containerRes.json();
    const creationId = container.id;

    // Step 3: Wait for container to be ready (poll status)
    let ready = false;
    let attempts = 0;
    while (!ready && attempts < 10) {
      const statusRes = await fetch(
        `https://graph.instagram.com/v22.0/${creationId}?fields=status_code&access_token=${accessToken}`
      );
      const status = await statusRes.json();
      if (status.status_code === "FINISHED") {
        ready = true;
      } else if (status.status_code === "ERROR") {
        throw new Error("Instagram media container processing failed");
      } else {
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;
      }
    }

    if (!ready) {
      return {
        platformPostId: creationId,
        platformPostUrl: "",
      };
    }

    // Step 4: Publish the container
    const publishRes = await fetch(
      `https://graph.instagram.com/v22.0/${igAccountId}/media_publish?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: creationId }),
      }
    );

    if (!publishRes.ok) {
      throw new Error(`Instagram publish failed: ${await publishRes.text()}`);
    }

    const published = await publishRes.json();

    return {
      platformPostId: published.id,
      platformPostUrl: `https://www.instagram.com/p/${published.id}/`,
    };
  }

  async getComments(
    accessToken: string,
    postId: string,
    sinceId?: string
  ): Promise<PlatformComment[]> {
    const params = new URLSearchParams({
      fields: "id,text,username,timestamp",
    });
    if (sinceId) {
      params.set("after", sinceId);
    }

    const data = await this.request(
      `/${postId}/comments?${params}`,
      accessToken
    );

    if (!data.data) return [];

    return data.data.map(
      (comment: { id: string; text: string; username: string; timestamp: string }) => ({
        id: comment.id,
        text: comment.text,
        author: comment.username,
        createdAt: comment.timestamp,
        postId,
      })
    );
  }

  async replyToComment(
    accessToken: string,
    commentId: string,
    text: string
  ): Promise<string> {
    const data = await this.request(`/${commentId}/replies`, accessToken, {
      method: "POST",
      body: JSON.stringify({ message: text }),
    });

    return data.id;
  }

  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
  }> {
    // Instagram long-lived tokens are refreshed via GET
    const res = await fetch(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${refreshToken}`
    );

    if (!res.ok) {
      throw new Error(`Instagram token refresh failed: ${await res.text()}`);
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async getUserProfile(accessToken: string) {
    // Instagram Business Login returns a Facebook Graph API token
    // Use /me on graph.facebook.com to get the user's IG account
    const profile = await this.request(
      "/me?fields=id,name,instagram_business_account{id,username,name,profile_picture_url}",
      accessToken
    );

    // If user has an IG business account linked
    const ig = profile.instagram_business_account;
    if (ig) {
      return {
        id: ig.id,
        username: ig.username || "",
        displayName: ig.name || ig.username || profile.name || "",
        avatarUrl: ig.profile_picture_url || "",
      };
    }

    // Fallback: return Facebook profile info
    return {
      id: profile.id,
      username: profile.id,
      displayName: profile.name || "",
      avatarUrl: "",
    };
  }
}
