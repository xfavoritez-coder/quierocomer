import { NextRequest, NextResponse } from "next/server";
import { retryFailedPosOrders } from "@/lib/ecommerce/retryPos";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron: reintenta enviar al POS (Toteat) los pedidos del ecommerce que fallaron
 * (p. ej. la caja estaba cerrada en ese momento), en locales con el reintento
 * automático activado. Protegido con CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const r = await retryFailedPosOrders();
  return NextResponse.json({ ok: true, ...r });
}
