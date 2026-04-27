import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.mer-cat.com" },
      { protocol: "https", hostname: "api.mer-cat.com" },
      { protocol: "https", hostname: "tofuu.getjusto.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "cdn.bistrify.app" },
      { protocol: "https", hostname: "horusvegan.com" },
      { protocol: "https", hostname: "tb-static.uber.com" },
      { protocol: "https", hostname: "images.rappi.cl" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "**.amazonaws.com" },
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
