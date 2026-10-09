import { NextRequest, NextResponse } from "next/server";
import { resolveKdsRestaurant, kdsOrders, tokenForPairCode } from "@/lib/kds/liteServer";
import { kdsPage, pairPage } from "@/lib/kds/liteHtml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365 };
const htmlResponse = (html: string, status = 200) =>
  new NextResponse(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

// Página de la KDS liviana (sin React). Si la tablet no está vinculada, muestra
// la pantalla para escribir el código (o se vincula sola al abrir el QR con ?c=).
export async function GET(req: NextRequest) {
  const token = req.cookies.get("kds_token")?.value || "";
  let rest = token ? await resolveKdsRestaurant(token) : null;

  // Auto-vinculación por QR: /kds?c=CODIGO → deja la cookie y limpia la URL.
  const code = req.nextUrl.searchParams.get("c");
  if (!rest && code) {
    const t = await tokenForPairCode(code);
    if (t) {
      const res = NextResponse.redirect(new URL("/kds", req.url), { status: 303 });
      res.cookies.set("kds_token", t, COOKIE);
      return res;
    }
    return htmlResponse(pairPage("El código del QR es inválido o expiró. Genera uno nuevo."));
  }

  if (!rest) return htmlResponse(pairPage());

  const { pend, comp } = await kdsOrders(rest.id);
  const now = Math.floor(Date.now() / 1000);
  return htmlResponse(kdsPage({ pend, comp, now }, rest.name));
}
