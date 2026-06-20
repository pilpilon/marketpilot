import type {
  SocialPlatformClient,
  PlatformPublishResult,
  PlatformComment,
} from "./index";

/**
 * LinkedIn Personal Profile connector.
 *
 * Uses the LinkedIn Posts API v2 with the "Share on LinkedIn" product.
 * Scope: w_member_social (posting), r_liteprofile / openid+profile (member ID).
 *
 * Company Page posting requires the Marketing API + review — NOT supported here.
 */
export class LinkedInClient implements SocialPlatformClient {
  platform = "linkedin" as const;

  private apiUrl = "https://api.linkedin.com";
  private linkedinVersion = "202506"; // LinkedIn API version header (YYYYMM)

  /**
   * Generic API request helper.
   */
  private async request(
    path: string,
    accessToken: string,
    options: RequestInit = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    const url = path.startsWith("http") ? path : `${this.apiUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": this.linkedinVersion,
      ...((options.headers as Record<string, string>) || {}),
    };

    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`LinkedIn API error (${res.status}): ${error}`);
    }

    // Some endpoints return 201 with empty body or just a Location header
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return res.json();
    }
    return {};
  }

  /**
   * Get the authenticated member's ID.
   * Tries OpenID Connect (/v2/userinfo) first, then falls back to legacy /v2/me.
   */
  private async getMemberId(
    accessToken: string,
    knownId?: string
  ): Promise<string> {
    if (knownId) return knownId;

    // Try OpenID Connect endpoint first
    try {
      const userinfo = await this.request(
        "/v2/userinfo",
        accessToken
      );
      if (userinfo.sub) return userinfo.sub;
    } catch {
      // Fall through to legacy endpoint
    }

    // Legacy r_liteprofile endpoint
    const profile = await this.request(
      "/v2/me",
      accessToken
    );
    if (!profile.id) {
      throw new Error("Could not determine LinkedIn member ID.");
    }
    return profile.id;
  }

  async publishText(
    accessToken: string,
    text: string
  ): Promise<PlatformPublishResult> {
    const memberId = await this.getMemberId(accessToken);
    const authorUrn = `urn:li:person:${memberId}`;

    const body = {
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      visibility: { visibility: "PUBLIC" },
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      commentary: text,
      isReshareDisabledByAuthor: false,
    };

    console.log(`[linkedin] publishText: memberId=${memberId}, text_length=${text.length}`);

    const result = await this.request("/v2/posts", accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // The Posts API returns the post URN in the response body or x-linkedin-id header
    const postUrn = result.id || result.postUrn || "";
    if (!postUrn) {
      throw new Error("LinkedIn post created but no post URN returned.");
    }

    return {
      platformPostId: postUrn,
      platformPostUrl: `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}/`,
    };
  }

  async publishMedia(
    accessToken: string,
    caption: string,
    mediaUrls: string[],
    platformUserId?: string
  ): Promise<PlatformPublishResult> {
    if (!mediaUrls.length) {
      throw new Error("LinkedIn publishing requires at least one media URL.");
    }

    const memberId = await this.getMemberId(accessToken, platformUserId);
    const authorUrn = `urn:li:person:${memberId}`;

    console.log(`[linkedin] publishMedia: memberId=${memberId}, media_count=${mediaUrls.length}, caption_length=${caption.length}`);

    // Step 1: Register and upload each image asset
    const assetUrns: string[] = [];
    for (const mediaUrl of mediaUrls.slice(0, 9)) { // LinkedIn allows max 9 images
      // Register the upload
      const registerBody = {
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: authorUrn,
          serviceRelationships: [
            {
              relationshipType: "PROXY",
              identifier: "urn:li:userGeneratedContent",
              identifierType: "URN",
            },
          ],
        },
      };

      const registerResult = await this.request(
        "/v2/assets?action=registerUpload",
        accessToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(registerBody),
        }
      );

      const assetUrn = registerResult?.value?.asset;
      const uploadUrl =
        registerResult?.value?.uploadMechanism?.[
          "com.linkedin.digitalmedia.uploading.COMPOUND_MEDIA_S3_UPLOAD"
        ]?.uploadUrl ||
        registerResult?.value?.uploadMechanism?.[
          "com.linkedin.digitalmedia.uploading.MEDIA_UPLOAD"
        ]?.uploadUrl;

      if (!assetUrn || !uploadUrl) {
        throw new Error(
          `LinkedIn image upload registration failed: ${JSON.stringify(registerResult)}`
        );
      }

      // Step 2: Download the media and upload to LinkedIn
      const mediaRes = await fetch(mediaUrl);
      if (!mediaRes.ok) {
        throw new Error(`Failed to download media from ${mediaUrl}: ${mediaRes.status}`);
      }
      const mediaBuffer = await mediaRes.arrayBuffer();

      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: mediaBuffer,
      });

      if (!uploadRes.ok) {
        const uploadErr = await uploadRes.text();
        throw new Error(`LinkedIn image upload failed (${uploadRes.status}): ${uploadErr}`);
      }

      console.log(`[linkedin] uploaded asset ${assetUrn}`);
      assetUrns.push(assetUrn);
    }

    // Step 3: Create the post referencing the uploaded assets
    let content: Record<string, unknown>;

    if (assetUrns.length === 1) {
      content = {
        media: {
          id: assetUrns[0],
          title: caption.substring(0, 300),
        },
      };
    } else {
      // Multiple images → multiImage content
      content = {
        multiImage: {
          images: assetUrns.map((urn) => ({ id: urn })),
        },
      };
    }

    const postBody = {
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      visibility: { visibility: "PUBLIC" },
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      commentary: caption,
      content,
      isReshareDisabledByAuthor: false,
    };

    const result = await this.request("/v2/posts", accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(postBody),
    });

    const postUrn = result.id || result.postUrn || "";
    if (!postUrn) {
      throw new Error("LinkedIn post created but no post URN returned.");
    }

    return {
      platformPostId: postUrn,
      platformPostUrl: `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}/`,
    };
  }

  async getComments(
    accessToken: string,
    postId: string,
    sinceId?: string
  ): Promise<PlatformComment[]> {
    // postId is stored as a URN (e.g. urn:li:share:12345 or urn:li:post:12345)
    let path = `/v2/socialActions/${encodeURIComponent(postId)}/comments?fields=id,message,actor,createdTime`;

    if (sinceId) {
      path += `&start=0&count=50`;
    }

    const data = await this.request(path, accessToken);

    if (!data.elements) return [];

    return data.elements.map(
      (comment: {
        id: string;
        message?: { text?: string; attributes?: unknown[] };
        actor?: { urn?: string; name?: { localized?: { en_US?: string } } };
        createdTime?: { epoch?: { second?: number } };
      }) => ({
        id: comment.id,
        text: comment.message?.text || "",
        author:
          comment.actor?.name?.localized?.en_US ||
          comment.actor?.urn?.split(":").pop() ||
          "Unknown",
        createdAt: comment.createdTime?.epoch?.second
          ? new Date(comment.createdTime.epoch.second * 1000).toISOString()
          : new Date().toISOString(),
        postId,
      })
    );
  }

  async replyToComment(
    accessToken: string,
    commentId: string,
    text: string
  ): Promise<string> {
    // commentId is the URN of the post or comment we're replying to
    const memberId = await this.getMemberId(accessToken);
    const body = {
      actor: `urn:li:person:${memberId}`,
      message: {
        text,
      },
    };

    const result = await this.request(
      `/v2/socialActions/${encodeURIComponent(commentId)}/comments`,
      accessToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    return result.id || result.commentId || "";
  }

  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
  }> {
    const clientId = process.env.LINKEDIN_CLIENT_ID!;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!;

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`LinkedIn token refresh failed: ${error}`);
    }

    const data = await res.json();

    // LinkedIn refresh tokens: access_token expires in ~60 days (5184000 seconds)
    // New refresh_token may or may not be returned (LinkedIn rotates it)
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + (data.expires_in || 5184000) * 1000),
    };
  }

  async getUserProfile(accessToken: string): Promise<{
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
  }> {
    // Try OpenID Connect /userinfo first (newer LinkedIn apps)
    try {
      const userinfo = await this.request("/v2/userinfo", accessToken);
      if (userinfo.sub) {
        return {
          id: userinfo.sub,
          username: userinfo.preferred_username || userinfo.given_name || userinfo.sub,
          displayName: userinfo.name || userinfo.given_name || "",
          avatarUrl: userinfo.picture || "",
        };
      }
    } catch {
      // Fall through to legacy endpoint
    }

    // Legacy r_liteprofile endpoint
    const profile = await this.request(
      "/v2/me?projection=(id,firstName,lastName,profilePicture(displayImage~:playableStreams))",
      accessToken
    );

    const firstName = profile.firstName?.localized
      ? Object.values(profile.firstName.localized)[0]
      : "";
    const lastName = profile.lastName?.localized
      ? Object.values(profile.lastName.localized)[0]
      : "";
    const displayName = `${firstName} ${lastName}`.trim();

    // Get profile picture URL
    let avatarUrl = "";
    if (profile.profilePicture?.["displayImage~"]?.elements) {
      const elements = profile.profilePicture["displayImage~"].elements;
      const lastElement = elements[elements.length - 1];
      if (lastElement?.identifiers?.[0]?.identifier) {
        avatarUrl = lastElement.identifiers[0].identifier;
      }
    }

    return {
      id: profile.id,
      username: profile.id,
      displayName,
      avatarUrl,
    };
  }
}
