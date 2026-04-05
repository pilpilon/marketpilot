import type {
  SocialPlatformClient,
  PlatformPublishResult,
  PlatformComment,
} from "./index";

export class InstagramClient implements SocialPlatformClient {
  platform = "instagram" as const;

  // Instagram Content Publishing via Facebook Graph API
  private graphUrl = "https://graph.facebook.com/v22.0";

  private async get(path: string, accessToken: string) {
    const separator = path.includes("?") ? "&" : "?";
    const url = `${this.graphUrl}${path}${separator}access_token=${accessToken}`;
    console.log(`[instagram] GET ${this.graphUrl}${path.split("?")[0]}`);

    const res = await fetch(url);

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Instagram API error (${res.status}): ${error}`);
    }

    return res.json();
  }

  private async post(path: string, accessToken: string, body: Record<string, unknown>) {
    const url = `${this.graphUrl}${path}`;
    console.log(`[instagram] POST ${url}`);

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

  /**
   * Resolve the Instagram Business account via the Facebook user token.
   * Mirrors FacebookClient.resolvePage — uses project name to pick the right page,
   * then reads page.instagram_business_account and returns the PAGE token (required
   * for IG content publishing; the IG business account is impersonated via its owning page).
   */
  private async resolveIgAccount(fbUserToken: string, projectName?: string): Promise<{ igId: string; pageAccessToken: string }> {
    const res = await this.get("/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}", fbUserToken);
    const pages: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }> = res.data || [];

    const withIg = pages.filter((p) => p.instagram_business_account?.id);
    if (!withIg.length) {
      throw new Error("No Instagram Business account found on any Facebook Page. Link an IG Business account to a Page in Meta Business Suite.");
    }

    let chosen = withIg[0];
    if (projectName) {
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const target = norm(projectName);
      const match = withIg.find((p) => norm(p.name) === target) || withIg.find((p) => norm(p.name).includes(target) || target.includes(norm(p.name)));
      if (match) chosen = match;
      else console.log(`[instagram] no page name matched project="${projectName}" — defaulting to first IG-enabled page "${chosen.name}"`);
    }

    console.log(`[instagram] resolved IG account ${chosen.instagram_business_account!.id} (${chosen.instagram_business_account!.username}) via page "${chosen.name}"`);
    return { igId: chosen.instagram_business_account!.id, pageAccessToken: chosen.access_token };
  }

  async publishMedia(
    accessToken: string,
    caption: string,
    mediaUrls: string[],
    publishHint?: string
  ): Promise<PlatformPublishResult> {
    // publishHint = project name (passed by publisher.ts for FB-style resolution)
    const { igId: igAccountId, pageAccessToken } = await this.resolveIgAccount(accessToken, publishHint);
    console.log(`[instagram] publishMedia: igAccountId=${igAccountId}, mediaUrl=${mediaUrls[0]?.substring(0, 80)}...`);

    // Create media container (use PAGE access token, not user token)
    const container = await this.post(
      `/${igAccountId}/media`,
      pageAccessToken,
      { image_url: mediaUrls[0], caption }
    );

    const creationId = container.id;
    console.log(`[instagram] container created: id=${creationId}`);

    // Wait for container to be ready
    let ready = false;
    let attempts = 0;
    while (!ready && attempts < 10) {
      const status = await this.get(
        `/${creationId}?fields=status_code`,
        pageAccessToken
      );
      console.log(`[instagram] container status (attempt ${attempts + 1}): ${status.status_code}`);
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
      throw new Error("Instagram media container timed out — image may be too large or unsupported");
    }

    // Publish
    console.log(`[instagram] publishing container ${creationId}...`);
    const published = await this.post(
      `/${igAccountId}/media_publish`,
      pageAccessToken,
      { creation_id: creationId }
    );
    console.log(`[instagram] published! id=${published.id}`);

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
    // Facebook Page tokens obtained with a long-lived user token don't expire
    // But if refresh is needed, exchange via Facebook Graph API
    const res = await fetch(
      `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&fb_exchange_token=${refreshToken}`
    );

    if (!res.ok) {
      throw new Error(`Instagram token refresh failed: ${await res.text()}`);
    }

    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.access_token,
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
