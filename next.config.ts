import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

export default nextConfig;
