// Enlaces de descarga de la app (Google Play / App Store) por local. Se guardan
// en ecommerceStoreConfig y se usan en el menú del ecommerce.
// GET ?restaurantId= → { appAndroidUrl, appIosUrl }
// PUT { restaurantId, appAndroidUrl, appIosUrl }
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/adminAuth";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";
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

// Solo URLs http(s) o vacío (para borrar).
function cleanUrl(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return null;
  return s.slice(0, 400);
}

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceStoreConfig: true } });
  const cfg = parseStoreConfig(r?.ecommerceStoreConfig);
  return NextResponse.json({ appAndroidUrl: cfg.appAndroidUrl, appIosUrl: cfg.appIosUrl });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = String(body?.restaurantId || "");
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const appAndroidUrl = cleanUrl(body?.appAndroidUrl);
  const appIosUrl = cleanUrl(body?.appIosUrl);
  // Rechaza URLs mal formadas (no vacías pero sin http).
  if ((body?.appAndroidUrl && !appAndroidUrl) || (body?.appIosUrl && !appIosUrl)) {
    return NextResponse.json({ error: "Los enlaces deben empezar con https://" }, { status: 400 });
  }

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceStoreConfig: true } });
  const raw = (r?.ecommerceStoreConfig && typeof r.ecommerceStoreConfig === "object" && !Array.isArray(r.ecommerceStoreConfig))
    ? { ...(r.ecommerceStoreConfig as Record<string, unknown>) } : {};
  raw.appAndroidUrl = appAndroidUrl;
  raw.appIosUrl = appIosUrl;
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { ecommerceStoreConfig: raw as object } });
  revalidateEcommerceCache({ id: restaurantId });
  return NextResponse.json({ ok: true, appAndroidUrl, appIosUrl });
}
