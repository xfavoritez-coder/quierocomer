import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";

export const runtime = "nodejs";

/** Manifest PWA por local (tienda del ecommerce). El `base` lo pasa el storefront
 *  según el host: "" en dominio propio (handroll.cl) o "/ecommerce/<slug>" en el
 *  dominio principal — así el ícono instalado abre la tienda correcta. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const base = (req.nextUrl.searchParams.get("base") || "").replace(/\/$/, "");
  const start = base || "/";

  const r = await prisma.restaurant.findFirst({
    where: { OR: [{ slug }, { ecommerceStoreConfig: { path: ["customDomain"], equals: slug } }] },
    select: { name: true, logoUrl: true, ecommerceStoreConfig: true, cartaAccentColor: true },
  });
  if (!r) return NextResponse.json({ name: "Tienda" }, { status: 404 });

  const store = parseStoreConfig(r.ecommerceStoreConfig, { accent: r.cartaAccentColor });
  const icon = store.faviconUrl || r.logoUrl || "/icon-192.png";

  const manifest = {
    name: r.name,
    short_name: r.name.slice(0, 12),
    description: `Pedí online en ${r.name}.`,
    id: start,
    start_url: start,
    scope: base ? base + "/" : "/",
    display: "standalone",
    background_color: store.headerBgColor || "#ffffff",
    theme_color: store.primaryColor || "#e63946",
    orientation: "portrait",
    icons: [
      { src: icon, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: icon, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
