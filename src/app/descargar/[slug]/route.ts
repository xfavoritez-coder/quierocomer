// Smart link de descarga: detecta el SO del cliente por User-Agent y redirige a
// la tienda correcta (Android → Google Play, iPhone → App Store). En escritorio
// muestra una página con ambos botones. Enlace único por local: /descargar/<slug>.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esc = (s: string) => (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await prisma.restaurant.findFirst({ where: { slug }, select: { name: true, logoUrl: true, appAndroidUrl: true, appIosUrl: true, ecommerceStoreConfig: true } });
  if (!r) return NextResponse.redirect("https://quierocomer.com");

  const cfg = parseStoreConfig(r.ecommerceStoreConfig);
  const android = r.appAndroidUrl;
  const ios = r.appIosUrl;
  const storeUrl = cfg.customDomain ? `https://${cfg.customDomain}` : `https://quierocomer.com/ecommerce/${slug}`;
  const logo = cfg.storeLogoUrl || r.logoUrl || "";

  const ua = req.headers.get("user-agent") || "";
  const isIOS = /iPad|iPhone|iPod/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua));
  const isAndroid = /Android/i.test(ua);

  // Móvil: redirige a su tienda; si falta la suya pero existe la otra, usa esa.
  if (isIOS && (ios || android)) return NextResponse.redirect(ios || android!);
  if (isAndroid && (android || ios)) return NextResponse.redirect(android || ios!);

  // Sin enlaces configurados → a la tienda online.
  if (!android && !ios) return NextResponse.redirect(storeUrl);

  // Escritorio / SO desconocido → página con ambos botones.
  const btn = (href: string, label: string) =>
    `<a href="${esc(href)}" style="display:flex;align-items:center;justify-content:center;gap:10px;padding:15px 20px;border-radius:14px;background:#111;color:#fff;text-decoration:none;font-weight:700;font-size:16px;margin:8px 0;">${label}</a>`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Descargar la app · ${esc(r.name)}</title></head>
<body style="margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f4f4f5;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px;">
  <div style="background:#fff;border-radius:20px;box-shadow:0 10px 40px rgba(0,0,0,.1);padding:28px;max-width:360px;width:100%;text-align:center;">
    ${logo ? `<img src="${esc(logo)}" alt="" style="width:72px;height:72px;border-radius:18px;object-fit:cover;margin:0 auto 14px;">` : ""}
    <h1 style="font-size:20px;margin:0 0 6px;color:#18181b;">Descarga la app de ${esc(r.name)}</h1>
    <p style="font-size:14px;color:#71717a;margin:0 0 18px;">Elige tu tienda:</p>
    ${android ? btn(android, "📲 Descargar para Android") : ""}
    ${ios ? btn(ios, " Descargar para iPhone") : ""}
  </div>
</body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
