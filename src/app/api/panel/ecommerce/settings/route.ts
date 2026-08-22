import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseStoreConfig, ALL_PAYMENT_METHODS } from "@/lib/ecommerce/store-config";

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

function fallbackFor(r: { cartaAccentColor: string | null; orderingPaymentMethods: string | null }) {
  return {
    accent: r.cartaAccentColor,
    paymentMethods: (r.orderingPaymentMethods || "").split(",").map((s) => s.trim()).filter(Boolean),
  };
}

/** GET → config de tienda (colores, métodos de pago, notas) con defaults resueltos. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceStoreConfig: true, cartaAccentColor: true, orderingPaymentMethods: true } });
  if (!r) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json({ config: parseStoreConfig(r.ecommerceStoreConfig, fallbackFor(r)), allMethods: ALL_PAYMENT_METHODS });
}

/** PUT → guarda la config de tienda. */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = body?.restaurantId as string | undefined;
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { cartaAccentColor: true, orderingPaymentMethods: true } });
  if (!r) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const config = parseStoreConfig(body?.config, fallbackFor(r));
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { ecommerceStoreConfig: config as unknown as object } });
  return NextResponse.json({ ok: true, config });
}
