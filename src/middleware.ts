import { NextRequest, NextResponse } from "next/server";

// ═══════════════════════════════════════════════════════════
//  Enrutado por dominio propio.
//
//  Hay dos tipos de dominio propio:
//
//  1. CARTA (solo menú digital):
//     El restaurante tiene su propio dominio que muestra su carta/menú.
//     Configurado via env var CARTA_DOMAINS="pollocampo.cl:pollocampo,otro.cl:otro-slug"
//     pollocampo.cl/       →  (interno) /pollocampo
//     pollocampo.cl/plato  →  (interno) /pollocampo/plato
//
//  2. ECOMMERCE (tienda online con pedidos):
//     Un local tiene dominio propio para su tienda de pedidos online.
//     haruna.cl/           →  (interno) /ecommerce/haruna.cl
//     haruna.cl/checkout   →  (interno) /ecommerce/haruna.cl/checkout
//     El loader resuelve la tienda por customDomain en ecommerceStoreConfig.
// ═══════════════════════════════════════════════════════════

const MAIN_DOMAIN = (process.env.NEXT_PUBLIC_APP_DOMAIN || "quierocomer.com").toLowerCase();

// CARTA_DOMAINS="pollocampo.cl:pollocampo,otro.cl:otro-slug"
function buildCartaMap(): Record<string, string> {
  const raw = process.env.CARTA_DOMAINS || "";
  const map: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const [domain, slug] = pair.trim().split(":");
    if (domain && slug) map[domain.trim()] = slug.trim();
  }
  return map;
}
const CARTA_MAP = buildCartaMap();

// Hosts que pertenecen a la app → sin reescritura.
function isAppHost(host: string): boolean {
  if (!host) return true;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.endsWith(".vercel.app")) return true;
  if (host === MAIN_DOMAIN || host === `www.${MAIN_DOMAIN}`) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const rawHost = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  if (isAppHost(rawHost)) return NextResponse.next();

  const host = rawHost.replace(/^www\./, "");
  const { pathname, search } = req.nextUrl;

  // Panel y admin siempre van al dominio principal.
  if (pathname.startsWith("/panel") || pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL(pathname + search, `https://${MAIN_DOMAIN}`));
  }

  // ── Dominio de CARTA ──────────────────────────────────────
  const cartaSlug = CARTA_MAP[host];
  if (cartaSlug) {
    // Solo reescribir la raíz. El resto de rutas (/qr/…, /pedir/…, /fidelidad/…)
    // son paths absolutos de QC — pasan directo sin modificar.
    if (pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = `/${cartaSlug}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // ── Dominio de ECOMMERCE ──────────────────────────────────
  const isStorePage = pathname === "/" || pathname === "/checkout" || pathname.startsWith("/checkout/");
  if (!isStorePage) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/ecommerce/${host}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Excluye API, assets de Next, favicon y archivos con extensión.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
