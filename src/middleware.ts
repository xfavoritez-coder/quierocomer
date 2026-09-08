import { NextRequest, NextResponse } from "next/server";

// ═══════════════════════════════════════════════════════════
//  Enrutado por dominio propio (custom domain) del Ecommerce.
//  Un local puede tener su propio dominio (ej: haruna.cl). Cuando el request
//  llega por ese dominio, reescribimos internamente a la ruta del storefront
//  correspondiente SIN cambiar la URL que ve el usuario → URLs limpias:
//    haruna.cl/           →  (interno) /ecommerce/haruna.cl
//    haruna.cl/checkout   →  (interno) /ecommerce/haruna.cl/checkout
//  El resto de rutas (/pedido/…, etc.) pasan como rutas reales. El loader
//  resuelve la tienda por slug o por customDomain (ecommerceStoreConfig).
// ═══════════════════════════════════════════════════════════

const MAIN_DOMAIN = (process.env.NEXT_PUBLIC_APP_DOMAIN || "quierocomer.com").toLowerCase();

// Hosts que pertenecen a la app (no son dominios de tienda) → sin reescritura.
function isAppHost(host: string): boolean {
  if (!host) return true;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.endsWith(".vercel.app")) return true; // previews y dominio por defecto
  if (host === MAIN_DOMAIN || host === `www.${MAIN_DOMAIN}`) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const rawHost = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  if (isAppHost(rawHost)) return NextResponse.next();

  // Dominio de tienda → normalizamos (sin www) y usamos el host como clave.
  const host = rawHost.replace(/^www\./, "");
  const { pathname, search } = req.nextUrl;

  // El panel y el admin no se sirven desde dominios de tienda → al dominio principal.
  if (pathname.startsWith("/panel") || pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL(pathname + search, `https://${MAIN_DOMAIN}`));
  }

  // Solo reescribimos las páginas propias de la tienda (menú y checkout).
  // Lo demás (/pedido/…, etc.) se sirve como ruta real de la app.
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
