import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.mer-cat.com" },
      { protocol: "https", hostname: "tofuu.getjusto.com" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
    formats: ["image/webp", "image/avif"],
    deviceSizes: [120, 240, 360, 480],
    imageSizes: [64, 96, 128, 256],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
