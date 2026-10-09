import { NextRequest, NextResponse } from "next/server";
import { resolveKdsRestaurant, kdsOrders } from "@/lib/kds/liteServer";
import { kdsPage, pairPage } from "@/lib/kds/liteHtml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const htmlResponse = (html: string, status = 200) =>
  new NextResponse(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

// Página de la KDS liviana (sin React). Si la tablet no está vinculada, muestra
// la pantalla para escribir el código de emparejamiento.
export async function GET(req: NextRequest) {
  const token = req.cookies.get("kds_token")?.value || "";
  const rest = token ? await resolveKdsRestaurant(token) : null;
  if (!rest) return htmlResponse(pairPage());

  const { pend, comp } = await kdsOrders(rest.id);
  const now = Math.floor(Date.now() / 1000);
  return htmlResponse(kdsPage({ pend, comp, now }, rest.name));
}
