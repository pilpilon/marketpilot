import type {
  SocialPlatformClient,
  PlatformPublishResult,
  PlatformComment,
} from "./index";

export class InstagramClient implements SocialPlatformClient {
  platform = "instagram" as const;

  // Instagram API endpoints are migrating to graph.facebook.com
  private graphUrl = "https://graph.facebook.com/v22.0";

  private async request(path: string, accessToken: string, options: RequestInit = {}) {
    const separator = path.includes("?") ? "&" : "?";
    const url = `${this.graphUrl}${path}${separator}access_token=${accessToken}`;

    const headers: Record<string, string> = {};
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
    throw new Error("Instagram requires media content. Text-only posts are not supported.");
  }

  async publishMedia(
    accessToken: string,
    caption: string,
    mediaUrls: string[]
  ): Promise<PlatformPublishResult> {
    // Get the Instagram user ID
    const me = await this.request("/me?fields=id,instagram_business_account", accessToken);
    const igAccountId = me.instagram_business_account?.id || me.id;
    if (!igAccountId) {
      throw new Error("Could not get Instagram account ID");
    }

    // Create media container
    const container = await this.request(
      `/${igAccountId}/media`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          image_url: mediaUrls[0],
          caption,
        }),
      }
    );

    const creationId = container.id;

    // Wait for container to be ready
    let ready = false;
    let attempts = 0;
    while (!ready && attempts < 10) {
      const status = await this.request(
        `/${creationId}?fields=status_code`,
        accessToken
      );
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
      return { platformPostId: creationId, platformPostUrl: "" };
    }

    // Publish
    const published = await this.request(
      `/${igAccountId}/media_publish`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({ creation_id: creationId }),
      }
    );

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
    if (sinceId) params.set("after", sinceId);

    const data = await this.request(`/${postId}/comments?${params}`, accessToken);
    if (!data.data) return [];

    return data.data.map(
      (c: { id: string; text: string; username: string; timestamp: string }) => ({
        id: c.id,
        text: c.text,
        author: c.username,
        createdAt: c.timestamp,
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
    // Use Facebook Graph API for token refresh
    const res = await fetch(
      `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=ig_refresh_token&access_token=${refreshToken}`
    );

    if (!res.ok) {
      throw new Error(`Instagram token refresh failed: ${await res.text()}`);
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 5184000) * 1000),
    };
  }

  async getUserProfile(accessToken: string) {
    // Get user info via Facebook Graph API
    const me = await this.request(
      "/me?fields=id,name,picture{url},instagram_business_account{id,username,name,profile_picture_url}",
      accessToken
    );

    console.log(`[instagram] getUserProfile response keys: ${Object.keys(me).join(", ")}`);

    // If linked IG business account exists, use it
    const ig = me.instagram_business_account;
    if (ig) {
      return {
        id: ig.id,
        username: ig.username || "",
        displayName: ig.name || ig.username || me.name || "",
        avatarUrl: ig.profile_picture_url || me.picture?.data?.url || "",
      };
    }

    // Fallback to Facebook profile
    return {
      id: me.id,
      username: me.name || me.id,
      displayName: me.name || "",
      avatarUrl: me.picture?.data?.url || "",
    };
  }
}
