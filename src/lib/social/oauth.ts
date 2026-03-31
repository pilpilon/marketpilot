import crypto from "crypto";
import type { Platform } from "@/types/database";

export function generateState(): string {
  return crypto.randomUUID();
}

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

interface OAuthConfig {
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  usePKCE: boolean;
}

const platformConfigs: Record<Platform, () => OAuthConfig> = {
  twitter: () => ({
    authUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    clientId: process.env.TWITTER_CLIENT_ID!,
    clientSecret: process.env.TWITTER_CLIENT_SECRET!,
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    usePKCE: true,
  }),
  instagram: () => ({
    authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    clientId: process.env.FACEBOOK_APP_ID!,
    clientSecret: process.env.FACEBOOK_APP_SECRET!,
    scopes: [
      "instagram_basic",
      "instagram_content_publish",
      "instagram_manage_comments",
      "pages_show_list",
      "pages_read_engagement",
    ],
    usePKCE: false,
  }),
  tiktok: () => ({
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    clientId: process.env.TIKTOK_CLIENT_KEY!,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET!,
    scopes: [
      "user.info.basic",
      "video.publish",
      "video.upload",
      "comment.list",
    ],
    usePKCE: false,
  }),
};

export function getOAuthConfig(platform: Platform): OAuthConfig {
  return platformConfigs[platform]();
}

export function buildAuthorizationUrl(
  platform: Platform,
  redirectUri: string,
  state: string,
  codeChallenge?: string
): string {
  const config = getOAuthConfig(platform);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: redirectUri,
    state,
    scope: config.scopes.join(" "),
  });

  if (platform === "tiktok") {
    // TikTok uses client_key instead of client_id
    params.delete("client_id");
    params.set("client_key", config.clientId);
  }

  if (config.usePKCE && codeChallenge) {
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
  }

  return `${config.authUrl}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  platform: Platform,
  code: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope?: string;
}> {
  const config = getOAuthConfig(platform);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  if (config.usePKCE && codeVerifier) {
    body.set("code_verifier", codeVerifier);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (platform === "twitter") {
    headers["Authorization"] = `Basic ${Buffer.from(
      `${config.clientId}:${config.clientSecret}`
    ).toString("base64")}`;
  } else {
    body.set("client_id", config.clientId);
    body.set("client_secret", config.clientSecret);
  }

  if (platform === "tiktok") {
    body.delete("client_id");
    body.set("client_key", config.clientId);
  }

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Token exchange failed for ${platform}: ${error}`);
  }

  const data = await res.json();

  // Instagram: exchange short-lived token for long-lived token
  if (platform === "instagram") {
    const longLivedRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.clientId}&client_secret=${config.clientSecret}&fb_exchange_token=${data.access_token}`
    );

    if (longLivedRes.ok) {
      const longLivedData = await longLivedRes.json();
      return {
        accessToken: longLivedData.access_token,
        refreshToken: longLivedData.access_token, // IG uses same token for refresh
        expiresIn: longLivedData.expires_in || 5184000, // 60 days
      };
    }
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 7200,
    scope: data.scope,
  };
}
