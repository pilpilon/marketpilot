import type {
  SocialPlatformClient,
  PlatformPublishResult,
  PlatformComment,
} from "./index";

export class InstagramClient implements SocialPlatformClient {
  platform = "instagram" as const;

  // Per Meta docs: Instagram API uses graph.instagram.com (no version prefix for some endpoints)
  private graphUrl = "https://graph.instagram.com";

  private async get(path: string, accessToken: string) {
    const separator = path.includes("?") ? "&" : "?";
    const url = `${this.graphUrl}${path}${separator}access_token=${accessToken}`;

    // Pure GET — no headers (Instagram rejects GET with Content-Type)
    const res = await fetch(url);

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Instagram API error (${res.status}): ${error}`);
    }

    return res.json();
  }

  private async post(path: string, accessToken: string, body: Record<string, unknown>) {
    const url = `${this.graphUrl}${path}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        ...Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v)])),
        access_token: accessToken,
      }),
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
    const profile = await this.get("/me?fields=user_id", accessToken);
    const igAccountId = profile.user_id || profile.id;
    if (!igAccountId) {
      throw new Error("Could not get Instagram user ID");
    }

    // Create media container
    const container = await this.post(
      `/${igAccountId}/media`,
      accessToken,
      { image_url: mediaUrls[0], caption }
    );

    const creationId = container.id;

    // Wait for container to be ready
    let ready = false;
    let attempts = 0;
    while (!ready && attempts < 10) {
      const status = await this.get(
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
    const published = await this.post(
      `/${igAccountId}/media_publish`,
      accessToken,
      { creation_id: creationId }
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
    let path = `/${postId}/comments?fields=id,text,username,timestamp`;
    if (sinceId) path += `&after=${sinceId}`;

    const data = await this.get(path, accessToken);
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
    const data = await this.post(`/${commentId}/replies`, accessToken, { message: text });
    return data.id;
  }

  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
  }> {
    // Per docs: GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token={token}
    const res = await fetch(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(refreshToken)}`
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
    // Per docs: GET /me?fields=user_id,username,name,profile_picture_url
    const profile = await this.get(
      "/me?fields=user_id,username,name,profile_picture_url,account_type",
      accessToken
    );

    console.log(`[instagram] getUserProfile: id=${profile.user_id || profile.id} username=${profile.username}`);

    return {
      id: profile.user_id || profile.id,
      username: profile.username || "",
      displayName: profile.name || profile.username || "",
      avatarUrl: profile.profile_picture_url || "",
    };
  }
}
