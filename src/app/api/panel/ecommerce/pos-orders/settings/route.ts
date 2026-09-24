import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCentroPedidosConfig, parseEcommerceConfig, effectivePosMode, type CentroPedidosConfig } from "@/lib/ecommerce/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) {
    const m = await prisma.teamMember.findUnique({ where: { id: panelId.slice(3) }, select: { restaurantId: true } });
    return m?.restaurantId === restaurantId;
  }
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

/** GET /api/panel/ecommerce/pos-orders/settings?restaurantId=X → config del pilar. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { centroPedidosConfig: true, ecommerceConfig: true } });
  const config = parseCentroPedidosConfig(r?.centroPedidosConfig);
  const ecom = parseEcommerceConfig(r?.ecommerceConfig);
  const hasPos = ecom.pos?.provider === "toteat";
  return NextResponse.json({ config, hasPos, posModeEffective: effectivePosMode(config, ecom) });
}

/** PUT /api/panel/ecommerce/pos-orders/settings → guarda la config del pilar.
 *  Body: { restaurantId, config: { autoDeliverPickup } } */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const current = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { centroPedidosConfig: true } });
  const merged: CentroPedidosConfig = { ...parseCentroPedidosConfig(current?.centroPedidosConfig) };
  const incoming = parseCentroPedidosConfig(body?.config);
  if (typeof incoming.autoDeliverPickup === "boolean") merged.autoDeliverPickup = incoming.autoDeliverPickup;
  if (typeof incoming.posMode === "boolean") merged.posMode = incoming.posMode;

  await prisma.restaurant.update({ where: { id: restaurantId }, data: { centroPedidosConfig: merged as unknown as object } });
  return NextResponse.json({ ok: true, config: merged });
}
