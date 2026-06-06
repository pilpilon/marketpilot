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

  /**
   * Resolve the correct Facebook Page for publishing.
   * Uses projectName (passed via platformUserId field) to match when user manages multiple pages.
   */
  private async resolvePage(accessToken: string, projectName?: string) {
    const pages = await this.request("/me/accounts", accessToken);
    const allPages = pages.data || [];
    if (!allPages.length) {
      throw new Error("No Facebook Pages found. You need a Facebook Page to publish.");
    }

    // Match by project name if provided
    if (projectName) {
      const name = projectName.toLowerCase();
      const match = allPages.find(
        (p: { name: string }) =>
          p.name.toLowerCase().includes(name) || name.includes(p.name.toLowerCase())
      );
      if (match) return match;
    }

    return allPages[0];
  }

  async publishText(
    accessToken: string,
    text: string
  ): Promise<PlatformPublishResult> {
    const page = await this.resolvePage(accessToken);

    const data = await this.request(`/${page.id}/feed`, page.access_token, {
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
    const page = await this.resolvePage(accessToken, platformUserId);

    if (!mediaUrls.length) {
      throw new Error("Facebook publishing requires at least one media URL.");
    }

    if (mediaUrls.length > 1) {
      // Facebook multi-photo feed post flow:
      // 1) upload each photo as unpublished to get a media_fbid
      // 2) create one feed post with attached_media[]
      const uploadedPhotos: Array<{ media_fbid: string }> = [];
      for (const mediaUrl of mediaUrls) {
        const photo = await this.request(`/${page.id}/photos`, page.access_token, {
          method: "POST",
          body: JSON.stringify({
            url: mediaUrl,
            published: false,
          }),
        });
        uploadedPhotos.push({ media_fbid: photo.id });
      }

      const post = await this.request(`/${page.id}/feed`, page.access_token, {
        method: "POST",
        body: JSON.stringify({
          message: caption,
          attached_media: uploadedPhotos,
        }),
      });

      return {
        platformPostId: post.id,
        platformPostUrl: `https://www.facebook.com/${post.id}`,
      };
    }

    const data = await this.request(`/${page.id}/photos`, page.access_token, {
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
