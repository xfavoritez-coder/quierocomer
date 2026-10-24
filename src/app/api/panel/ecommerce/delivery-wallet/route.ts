import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBalance, getWalletBank, listTxns } from "@/lib/ecommerce/deliveryWallet";

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

/** GET /api/panel/ecommerce/delivery-wallet?restaurantId= → { balance, bank, txns, showBalance } */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const [balance, bank, txns, r] = await Promise.all([
    getBalance(restaurantId),
    getWalletBank(),
    listTxns(restaurantId, 60),
    prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { centroPedidosConfig: true } }),
  ]);
  const cfg = (r?.centroPedidosConfig as Record<string, unknown> | null) || {};
  return NextResponse.json({ balance, bank, txns, showBalance: cfg.showWalletBalance === true });
}

/** PUT { restaurantId, showBalance } → muestra/oculta el saldo en Centro de pedidos. */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (typeof body?.showBalance !== "boolean") return NextResponse.json({ error: "Falta showBalance" }, { status: 400 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { centroPedidosConfig: true } });
  const cfg = (r?.centroPedidosConfig as Record<string, unknown> | null) || {};
  cfg.showWalletBalance = body.showBalance;
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { centroPedidosConfig: cfg } });
  return NextResponse.json({ ok: true, showBalance: body.showBalance });
}
