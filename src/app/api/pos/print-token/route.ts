import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Entrega (y crea si falta) el token del agente de impresión del local. Es el
// MISMO token que usa el ecommerce (ecommerceStoreConfig.printToken), para que
// un solo agente imprima comandas del POS y del ecommerce.
// GET /api/pos/print-token?restaurantId=XXX  -> { ok, token, storeName }
export async function GET(req: NextRequest) {
  const restaurantId = (req.nextUrl.searchParams.get("restaurantId") || "").trim();
  if (!restaurantId) return NextResponse.json({ ok: false, error: "Falta restaurantId" }, { status: 400 });

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, ecommerceStoreConfig: true, posEnabled: true },
  });
  if (!restaurant) return NextResponse.json({ ok: false, error: "Local no encontrado" }, { status: 404 });
  if (!restaurant.posEnabled) return NextResponse.json({ ok: false, error: "POS no habilitado" }, { status: 403 });

  const cfg = ((restaurant.ecommerceStoreConfig as Record<string, unknown>) || {}) as Record<string, unknown>;
  let token = typeof cfg.printToken === "string" ? (cfg.printToken as string) : "";

  if (!token) {
    token = randomBytes(16).toString("hex");
    const next = { ...cfg, printToken: token, printTokenAt: new Date().toISOString() };
    await prisma.restaurant.update({ where: { id: restaurant.id }, data: { ecommerceStoreConfig: next as unknown as object } });
  }

  return NextResponse.json({ ok: true, token, storeName: restaurant.name });
}
