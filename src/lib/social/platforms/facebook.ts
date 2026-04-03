import type {
  SocialPlatformClient,
  PlatformPublishResult,
  PlatformComment,
} from "./index";

export class FacebookClient implements SocialPlatformClient {
  platform = "facebook" as const;

  private graphUrl = "https://graph.facebook.com/v22.0";

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
      throw new Error(`Facebook API error (${res.status}): ${error}`);
    }

    return res.json();
  }

  async publishText(
    accessToken: string,
    text: string
  ): Promise<PlatformPublishResult> {
    // accessToken is the Page access token (stored during connect).
    // platform_user_id is the Page ID — but publishText doesn't receive it,
    // so we resolve via /me which returns the Page when using a Page token.
    const me = await this.request("/me?fields=id", accessToken);
    const pageId = me.id;

    const data = await this.request(`/${pageId}/feed`, accessToken, {
      method: "POST",
      body: JSON.stringify({ message: text }),
    });

    return {
      platformPostId: data.id,
      platformPostUrl: `https://www.facebook.com/${data.id}`,
    };
  }

  async publishMedia(
    accessToken: string,
    caption: string,
    mediaUrls: string[],
    platformUserId?: string
  ): Promise<PlatformPublishResult> {
    // accessToken is the Page access token; platformUserId is the Page ID.
    // Fall back to /me if platformUserId not provided.
    let pageId = platformUserId;
    if (!pageId) {
      const me = await this.request("/me?fields=id", accessToken);
      pageId = me.id;
    }

    const data = await this.request(`/${pageId}/photos`, accessToken, {
      method: "POST",
      body: JSON.stringify({
        url: mediaUrls[0],
        caption,
      }),
    });

    return {
      platformPostId: data.id || data.post_id,
      platformPostUrl: `https://www.facebook.com/${data.post_id || data.id}`,
    };
  }

  async getComments(
    accessToken: string,
    postId: string,
    sinceId?: string
  ): Promise<PlatformComment[]> {
    const params = new URLSearchParams({
      fields: "id,message,from,created_time",
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
      (comment: { id: string; message: string; from: { name: string }; created_time: string }) => ({
        id: comment.id,
        text: comment.message,
        author: comment.from?.name || "Unknown",
        createdAt: comment.created_time,
        postId,
      })
    );
  }

  async replyToComment(
    accessToken: string,
    commentId: string,
    text: string
  ): Promise<string> {
    const data = await this.request(`/${commentId}/comments`, accessToken, {
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
    // Facebook long-lived tokens can be refreshed by exchanging again
    const clientId = process.env.FACEBOOK_APP_ID!;
    const clientSecret = process.env.FACEBOOK_APP_SECRET!;

    const res = await fetch(
      `${this.graphUrl}/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${refreshToken}`
    );

    if (!res.ok) {
      throw new Error(`Facebook token refresh failed: ${await res.text()}`);
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 5184000) * 1000),
    };
  }

  async getUserProfile(accessToken: string) {
    const profile = await this.request(
      "/me?fields=id,name,picture.type(large)",
      accessToken
    );

    return {
      id: profile.id,
      username: profile.id,
      displayName: profile.name || "",
      avatarUrl: profile.picture?.data?.url || "",
    };
  }
}
