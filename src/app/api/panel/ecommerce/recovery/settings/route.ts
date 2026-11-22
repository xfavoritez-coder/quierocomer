import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { isSuperAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  if (isSuperAdmin(req)) return true;
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) return teamMemberCanAccess(panelId.slice(3), restaurantId);
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

/** GET: lee la config de recovery. PUT: activa/desactiva. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceStoreConfig: true } });
  const cfg = (r?.ecommerceStoreConfig && typeof r.ecommerceStoreConfig === "object" && !Array.isArray(r.ecommerceStoreConfig))
    ? r.ecommerceStoreConfig as Record<string, unknown> : {};
  const recovery = (cfg.recovery && typeof cfg.recovery === "object") ? cfg.recovery as Record<string, unknown> : {};

  return NextResponse.json({ enabled: recovery.enabled === true });
}

export async function PUT(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json();
  const enabled = body.enabled === true;

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceStoreConfig: true } });
  const cfg = (r?.ecommerceStoreConfig && typeof r.ecommerceStoreConfig === "object" && !Array.isArray(r.ecommerceStoreConfig))
    ? { ...(r.ecommerceStoreConfig as Record<string, unknown>) } : {};

  const recovery = (cfg.recovery && typeof cfg.recovery === "object")
    ? { ...(cfg.recovery as Record<string, unknown>) } : {};
  recovery.enabled = enabled;
  cfg.recovery = recovery;

  await prisma.restaurant.update({ where: { id: restaurantId }, data: { ecommerceStoreConfig: cfg as object } });

  return NextResponse.json({ ok: true, enabled });
}
