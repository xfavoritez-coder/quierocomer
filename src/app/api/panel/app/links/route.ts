// Enlaces de descarga de la app (Google Play / App Store) por local. Se guardan
// en columnas propias de Restaurant (appAndroidUrl/appIosUrl) para que NO los
// pise el guardado de la config de tienda. Se usan en el menú del ecommerce.
// GET ?restaurantId= → { appAndroidUrl, appIosUrl }
// PUT { restaurantId, appAndroidUrl, appIosUrl }
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/adminAuth";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { revalidateEcommerceCache } from "@/lib/ecommerce/revalidate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  if (isSuperAdmin(req)) return true;
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) return teamMemberCanAccess(panelId.slice(3), restaurantId);
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

// Normaliza a URL http(s). Si viene sin protocolo pero parece dominio, antepone https://.
function cleanUrl(v: unknown): string | null {
  let s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) {
    if (/\.[a-z]{2,}/i.test(s)) s = "https://" + s.replace(/^\/+/, "");
    else return null;
  }
  return s.slice(0, 400);
}

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { appAndroidUrl: true, appIosUrl: true } });
  return NextResponse.json({ appAndroidUrl: r?.appAndroidUrl || null, appIosUrl: r?.appIosUrl || null });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = String(body?.restaurantId || "");
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const appAndroidUrl = cleanUrl(body?.appAndroidUrl);
  const appIosUrl = cleanUrl(body?.appIosUrl);
  if ((String(body?.appAndroidUrl || "").trim() && !appAndroidUrl) || (String(body?.appIosUrl || "").trim() && !appIosUrl)) {
    return NextResponse.json({ error: "Revisa los enlaces: deben ser una URL válida (ej. https://play.google.com/...)" }, { status: 400 });
  }

  await prisma.restaurant.update({ where: { id: restaurantId }, data: { appAndroidUrl, appIosUrl } });
  revalidateEcommerceCache({ id: restaurantId });
  return NextResponse.json({ ok: true, appAndroidUrl, appIosUrl });
}
