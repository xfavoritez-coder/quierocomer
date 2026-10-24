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

/** GET /api/panel/ecommerce/delivery-wallet?restaurantId= → { balance, bank, txns } */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const [balance, bank, txns] = await Promise.all([
    getBalance(restaurantId),
    getWalletBank(),
    listTxns(restaurantId, 60),
  ]);
  return NextResponse.json({ balance, bank, txns });
}
