import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { name: true },
  });

  const name = restaurant ? `Garzón · ${restaurant.name}` : "Garzón";

  const manifest = {
    name,
    short_name: restaurant ? restaurant.name : "Garzón",
    description: "Recibe llamadas de clientes en tiempo real",
    start_url: `/qr/admin/garzon/${slug}`,
    display: "standalone",
    background_color: "#0e0e0e",
    theme_color: "#F4A623",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-garzon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
