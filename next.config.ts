import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ["@resvg/resvg-js", "sharp"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ydusfdblkcpswigkeyvm.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
