import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

// Fija la raíz del workspace a esta carpeta (evita que Next infiera mal la raíz
// por un package-lock.json suelto en el Home del usuario).
const projectRoot = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  turbopack: { root: projectRoot },
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist", "pdf-lib"],
  async redirects() {
    return [
      { source: '/localesfeed/mapa', destination: '/localesfeed?tab=mapa', permanent: false },
      // WhatsApp truncó la URL y la mostró como "...quina" — redirige al local correcto
      { source: '/...quina', destination: 'https://quierocomer.com/pedir/el-menu-de-la-esquina', permanent: false },
      { source: '/%E2%80%A6quina', destination: 'https://quierocomer.com/pedir/el-menu-de-la-esquina', permanent: false },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1600],
    imageSizes: [128, 256, 384, 640],
    minimumCacheTTL: 60,
    // Next.js 16 requiere declarar las calidades usadas en next/image
    qualities: [75, 80, 95],
  },
  async headers() {
    return [
      {
        source: "/subircarta.html",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
        ],
      },
      {
        source: "/qr/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
        ],
      },
      {
        source: "/landing",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
        ],
      },
      {
        source: "/((?!qr/|landing).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
