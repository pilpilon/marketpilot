import type {
  SocialPlatformClient,
  PlatformPublishResult,
  PlatformComment,
} from "./index";

export class TwitterClient implements SocialPlatformClient {
  platform = "twitter" as const;

  private baseUrl = "https://api.twitter.com/2";

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
      throw new Error(`Twitter API error (${res.status}): ${error}`);
    }

    return res.json();
  }

  async publishText(
    accessToken: string,
    text: string
  ): Promise<PlatformPublishResult> {
    const data = await this.request("/tweets", accessToken, {
      method: "POST",
      body: JSON.stringify({ text }),
    });

    return {
      platformPostId: data.data.id,
      platformPostUrl: `https://twitter.com/i/web/status/${data.data.id}`,
    };
  }

  async publishMedia(
    accessToken: string,
    text: string,
    mediaUrls: string[]
  ): Promise<PlatformPublishResult> {
    // TODO: Upload media to Twitter first via media upload endpoint
    // For now, publish text only
    // Media upload requires v1.1 API with multipart form data
    return this.publishText(accessToken, text);
  }

  async getComments(
    accessToken: string,
    postId: string,
    sinceId?: string
  ): Promise<PlatformComment[]> {
    // Search for replies to this tweet
    const query = `conversation_id:${postId} is:reply`;
    const params = new URLSearchParams({
      query,
      "tweet.fields": "author_id,created_at,in_reply_to_user_id",
      max_results: "100",
    });

    if (sinceId) {
      params.set("since_id", sinceId);
    }

    const data = await this.request(
      `/tweets/search/recent?${params}`,
      accessToken
    );

    if (!data.data) return [];

    return data.data.map(
      (tweet: { id: string; text: string; author_id: string; created_at: string }) => ({
        id: tweet.id,
        text: tweet.text,
        author: tweet.author_id,
        createdAt: tweet.created_at,
        postId,
      })
    );
  }

  async replyToComment(
    accessToken: string,
    commentId: string,
    text: string
  ): Promise<string> {
    const data = await this.request("/tweets", accessToken, {
      method: "POST",
      body: JSON.stringify({
        text,
        reply: { in_reply_to_tweet_id: commentId },
      }),
    });

    return data.data.id;
  }

  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
  }> {
    const res = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      throw new Error(`Twitter token refresh failed: ${await res.text()}`);
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
      "/users/me?user.fields=profile_image_url,name,username",
      accessToken
    );

    return {
      id: data.data.id,
      username: data.data.username,
      displayName: data.data.name,
      avatarUrl: data.data.profile_image_url,
    };
  }
}
