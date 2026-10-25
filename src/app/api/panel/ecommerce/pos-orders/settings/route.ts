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

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { centroPedidosConfig: true, ecommerceConfig: true, ecommerceStoreConfig: true } });
  const config = parseCentroPedidosConfig(r?.centroPedidosConfig);
  const ecom = parseEcommerceConfig(r?.ecommerceConfig);
  const hasPos = ecom.pos?.provider === "toteat";
  const store = (r?.ecommerceStoreConfig && typeof r.ecommerceStoreConfig === "object") ? (r.ecommerceStoreConfig as Record<string, unknown>) : {};
  return NextResponse.json({ config, hasPos, posModeEffective: effectivePosMode(config, ecom), posShowDescriptions: store.posShowDescriptions === true });
}

/** PUT /api/panel/ecommerce/pos-orders/settings → guarda la config del pilar.
 *  Body: { restaurantId, config: { autoDeliverPickup } } */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const current = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { centroPedidosConfig: true, ecommerceStoreConfig: true } });
  const merged: CentroPedidosConfig = { ...parseCentroPedidosConfig(current?.centroPedidosConfig) };
  const incoming = parseCentroPedidosConfig(body?.config);
  if (typeof incoming.autoDeliverPickup === "boolean") merged.autoDeliverPickup = incoming.autoDeliverPickup;
  if (typeof incoming.posMode === "boolean") merged.posMode = incoming.posMode;
  if (typeof incoming.uberEnabled === "boolean") merged.uberEnabled = incoming.uberEnabled;
  if (typeof incoming.pedidosyaEnabled === "boolean") merged.pedidosyaEnabled = incoming.pedidosyaEnabled;
  if (typeof incoming.customerAbsorbsSurcharge === "boolean") merged.customerAbsorbsSurcharge = incoming.customerAbsorbsSurcharge;

  const data: { centroPedidosConfig: object; ecommerceStoreConfig?: object } = { centroPedidosConfig: merged as unknown as object };
  // "Mostrar descripción en Tomar pedidos" vive en ecommerceStoreConfig (lo lee el tomador).
  if (typeof body?.posShowDescriptions === "boolean") {
    const store = (current?.ecommerceStoreConfig && typeof current.ecommerceStoreConfig === "object") ? { ...(current.ecommerceStoreConfig as Record<string, unknown>) } : {};
    store.posShowDescriptions = body.posShowDescriptions;
    data.ecommerceStoreConfig = store;
  }

  await prisma.restaurant.update({ where: { id: restaurantId }, data });
  return NextResponse.json({ ok: true, config: merged, posShowDescriptions: data.ecommerceStoreConfig ? body.posShowDescriptions : undefined });
}
