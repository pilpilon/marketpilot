import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ["@takumi-rs/core", "sharp"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ydusfdblkcpswigkeyvm.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "cdn.higgsfield.ai",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "upload.higgsfield.ai",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**",
        pathname: "/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
