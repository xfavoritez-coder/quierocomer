// ═══════════════════════════════════════════════════════════
//  WORKER centralizado de seguimiento Delifast (POS).
//  Antes cada pantalla de caja raspaba Delifast cada 15s por pedido. Ahora un
//  solo worker consulta Delifast una vez por pedido activo y persiste el tracking
//  en PosOrder.delifastTracking; la UI lo lee de la BD (ver /api/pos/delivery-tracking).
//  Corre cada minuto y hace ~4 pasadas internas (cada 15s) para cadencia ~15s.
//  Protegido con CRON_SECRET.
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseEcommerceConfig, type DelifastCreds } from "@/lib/ecommerce/config";
import { decryptEcommerceSecrets } from "@/lib/ecommerce/configSecrets";
import { getDelifastTracking, resolveDelifastVentaId } from "@/lib/delifast/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function doPass(): Promise<{ orders: number; updated: number }> {
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000); // pedidos de las últimas 12h
  const orders = await prisma.posOrder.findMany({
    where: {
      isDelivery: true,
      posStatus: { not: "canceled" },
      opsStage: { notIn: ["delivered"] },
      createdAt: { gte: since },
      OR: [{ delifastVentaId: { not: null } }, { orderReference: { not: null } }],
    },
    select: { id: true, restaurantId: true, delifastVentaId: true, orderReference: true },
    orderBy: { createdAt: "desc" },
    take: 400,
  });
  if (!orders.length) return { orders: 0, updated: 0 };

  // Credenciales Delifast por local (solo los configurados).
  const rids = [...new Set(orders.map((o) => o.restaurantId))];
  const rests = await prisma.restaurant.findMany({ where: { id: { in: rids } }, select: { id: true, ecommerceConfig: true } });
  const credsByR = new Map<string, DelifastCreds>();
  for (const r of rests) {
    const c = decryptEcommerceSecrets(parseEcommerceConfig(r.ecommerceConfig)).delifast;
    if (c?.enabled && c.email && c.password && c.plataforma) credsByR.set(r.id, c);
  }

  let updated = 0;
  const CH = 5;
  for (let i = 0; i < orders.length; i += CH) {
    await Promise.all(orders.slice(i, i + CH).map(async (o) => {
      const creds = credsByR.get(o.restaurantId);
      if (!creds) return;
      try {
        let idVenta = o.delifastVentaId;
        if (!idVenta && o.orderReference) {
          idVenta = await resolveDelifastVentaId(o.restaurantId, creds, o.orderReference).catch(() => null);
          if (idVenta) await prisma.posOrder.update({ where: { id: o.id }, data: { delifastVentaId: idVenta } }).catch(() => {});
        }
        if (!idVenta) return;
        const tracking = await getDelifastTracking(o.restaurantId, creds, idVenta);
        await prisma.posOrder.update({
          where: { id: o.id },
          data: { delifastTracking: (tracking ?? Prisma.JsonNull) as object, delifastStatus: tracking?.status ?? null, delifastTrackedAt: new Date() },
        });
        updated++;
      } catch { /* un pedido que falle no detiene la pasada */ }
    }));
  }
  return { orders: orders.length, updated };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  let passes = 0, updated = 0, orders = 0;
  for (let i = 0; i < 4; i++) {
    const r = await doPass();
    passes++; updated += r.updated; orders = r.orders;
    if (i === 3 || Date.now() - start > 42000) break; // no queda tiempo para otra pasada
    await sleep(15000);
  }
  return NextResponse.json({ ok: true, passes, orders, updated, ms: Date.now() - start });
}
