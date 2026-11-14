// ═══════════════════════════════════════════════════════════
//  WORKER de CIERRE Delifast (POS) — SOLO completar/entregar.
//  El seguimiento EN VIVO (repartidor, ETA, ubicación, estados intermedios) lo
//  maneja el WEBHOOK de Delifast. Este worker es solo una RED DE SEGURIDAD para
//  el bug de Delifast: su webhook no dispara el evento "Entregado" (cuando el
//  pedido deja de estar activo), así que los pedidos quedan colgados en reparto.
//  Corre cada minuto (vercel.json) y, por cada pedido de delivery integrado con
//  Delifast que NO esté entregado, consulta Delifast y SOLO si figura "Entregado"
//  lo cierra (opsStage=delivered + sync + push). No toca estados intermedios ni
//  pisa el tracking en vivo del webhook. Protegido con CRON_SECRET.
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseEcommerceConfig, type DelifastCreds } from "@/lib/ecommerce/config";
import { decryptEcommerceSecrets } from "@/lib/ecommerce/configSecrets";
import { getDelifastTracking, resolveDelifastVentaId } from "@/lib/delifast/client";
import { getPlatformSetting } from "@/lib/platformSettings";
import { toOpsStage } from "@/lib/delifast/status";
import { syncOnlineOrderFromPos } from "@/lib/ecommerce/syncOnlineFromPos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function closeDelivered(): Promise<{ orders: number; closed: number }> {
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000); // pedidos de las últimas 12h
  const orders = await prisma.posOrder.findMany({
    where: {
      isDelivery: true,
      posStatus: { not: "canceled" },
      opsStage: { notIn: ["delivered"] },
      createdAt: { gte: since },
      OR: [{ delifastVentaId: { not: null } }, { orderReference: { not: null } }],
    },
    select: { id: true, restaurantId: true, delifastVentaId: true, orderReference: true, opsStage: true, delifastTrackedAt: true, delifastTracking: true },
    orderBy: { createdAt: "desc" },
    take: 400,
  });
  // El webhook alimenta el estado en vivo: si lo actualizó hace <2 min, el pedido
  // sigue activo (aún no entregado), así que no lo consultamos todavía — el bug del
  // "Entregado" aparece justo cuando el webhook se queda callado tras la entrega.
  const pend = orders.filter((o) => {
    const t = o.delifastTracking as { source?: string } | null;
    if (t?.source === "webhook" && o.delifastTrackedAt && Date.now() - new Date(o.delifastTrackedAt).getTime() < 120_000) return false;
    return true;
  });
  if (!pend.length) return { orders: orders.length, closed: 0 };

  // Credenciales Delifast por local (solo los configurados).
  const rids = [...new Set(pend.map((o) => o.restaurantId))];
  const rests = await prisma.restaurant.findMany({ where: { id: { in: rids } }, select: { id: true, ecommerceConfig: true } });
  const credsByR = new Map<string, DelifastCreds>();
  for (const r of rests) {
    const c = decryptEcommerceSecrets(parseEcommerceConfig(r.ecommerceConfig)).delifast;
    if (c?.enabled && c.email && c.password && c.plataforma) credsByR.set(r.id, c);
  }

  let closed = 0;
  const CH = 5;
  for (let i = 0; i < pend.length; i += CH) {
    await Promise.all(pend.slice(i, i + CH).map(async (o) => {
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
        // SOLO actuamos si Delifast ya lo marca "Entregado". Lo demás (en camino,
        // en local, etc.) es trabajo del webhook — no lo tocamos.
        if (toOpsStage(tracking?.status) !== "delivered") return;
        const res = await prisma.posOrder.update({
          where: { id: o.id },
          data: {
            opsStage: "delivered",
            opsDeliveredAt: new Date(),
            delifastStatus: tracking?.status ?? "Entregado",
            // Guardamos el tracking final (trae la foto de entrega + timeline) ya
            // que lo tenemos en mano; es parte de cerrar el pedido, no live-tracking.
            delifastTracking: (tracking ?? Prisma.JsonNull) as object,
            delifastTrackedAt: new Date(),
          },
          select: { restaurantId: true, externalId: true, opsStage: true, posStatus: true },
        });
        void syncOnlineOrderFromPos(res).catch(() => {}); // sincroniza OnlineOrder (DONE) + push al cliente
        closed++;
      } catch { /* un pedido que falle no detiene la pasada */ }
    }));
  }
  return { orders: orders.length, closed };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pausa global desde /admin/ajustes (no consulta Delifast mientras esté pausado).
  if ((await getPlatformSetting("delifast_tracking_paused")) === "1") {
    return NextResponse.json({ ok: true, paused: true });
  }

  const start = Date.now();
  const r = await closeDelivered();
  return NextResponse.json({ ok: true, orders: r.orders, closed: r.closed, ms: Date.now() - start });
}
