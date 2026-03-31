import type {
  SocialPlatformClient,
  PlatformPublishResult,
  PlatformComment,
} from "./index";

export class InstagramClient implements SocialPlatformClient {
  platform = "instagram" as const;

  private graphUrl = "https://graph.facebook.com/v21.0";

  private async request(path: string, accessToken: string, options: RequestInit = {}) {
    const separator = path.includes("?") ? "&" : "?";
    const url = `${this.graphUrl}${path}${separator}access_token=${accessToken}`;

    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
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
    // Step 1: Get the Instagram Business Account ID
    const accounts = await this.request(
      "/me/accounts?fields=instagram_business_account",
      accessToken
    );

    const igAccountId = accounts.data?.[0]?.instagram_business_account?.id;
    if (!igAccountId) {
      throw new Error("No Instagram Business Account found");
    }

    // Step 2: Create media container
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

    // Step 3: Wait for container to be ready (poll status)
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
      // Return creation_id for retry on next cron cycle
      return {
        platformPostId: creationId,
        platformPostUrl: "",
      };
    }

    // Step 4: Publish the container
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
      `${this.graphUrl}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&fb_exchange_token=${refreshToken}`
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
    // Get Facebook Page -> IG Business Account
    const accounts = await this.request(
      "/me/accounts?fields=instagram_business_account{id,username,name,profile_picture_url}",
      accessToken
    );

    const ig = accounts.data?.[0]?.instagram_business_account;
    if (!ig) {
      throw new Error("No Instagram Business Account found");
    }

    return {
      id: ig.id,
      username: ig.username || "",
      displayName: ig.name || ig.username || "",
      avatarUrl: ig.profile_picture_url || "",
    };
  }
}
