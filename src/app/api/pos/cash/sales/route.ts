import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { isSuperAdmin } from "@/lib/adminAuth";
import { chileDayRangeUtc, chileTodayYmd } from "@/lib/driver/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  if (isSuperAdmin(req)) return true;
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) return teamMemberCanAccess(panelId.slice(3), restaurantId);
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

// Normaliza un método de pago a las claves del arqueo del POS.
function normMethod(m?: string | null): string {
  const x = (m || "").toLowerCase().trim();
  if (!x) return "otros";
  if (x === "webpay" || x === "flow" || x === "mercadopago" || x === "transbank") return "webpay";
  if (x === "tarjeta" || x === "credito" || x === "crédito" || x === "credit") return "credito";
  if (x === "debito" || x === "débito" || x === "debit") return "debito";
  if (x === "transferencia" || x === "transfer") return "transferencia";
  if (x === "efectivo" || x === "cash") return "efectivo";
  if (x === "app_pago" || x === "app") return "app_pago";
  return x;
}

// Etiqueta de plataforma de delivery a partir del vendorName (Uber Eats, PedidosYa).
function platformLabel(vendorName?: string | null): string | null {
  const v = (vendorName || "").toLowerCase();
  if (v.includes("uber")) return "Uber Eats";
  if (v.includes("pedidosya") || v.includes("pedidos ya")) return "PedidosYa";
  if (v.includes("rappi")) return "Rappi";
  if (v.includes("didi")) return "DiDi Food";
  return null;
}

/** GET /api/pos/cash/sales?restaurantId=X&from=YYYY-MM-DD
 *  Ventas del turno (desde el día `from`, hora Chile) por método, combinando
 *  PosOrder (Centro) y OnlineOrder no-espejados (ecommerce nativo). Paga = el
 *  cliente pagó (paid online / offline / paidAmount >= total). */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  // Ventana por la CAJA (no por el día): cada cobro pertenece a la caja que estaba
  // abierta en ese instante. `from` = apertura de la caja (ISO), `to` = cierre o
  // ahora (ISO). Así dos cajas del mismo día NO comparten ventas. Acepta también
  // YYYY-MM-DD por compatibilidad (cae a medianoche de ese día, hora Chile).
  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  const parseFrom = (s: string | null): Date => {
    if (!s) return chileDayRangeUtc(chileTodayYmd()).start;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return chileDayRangeUtc(s).start;
    const d = new Date(s);
    return isNaN(d.getTime()) ? chileDayRangeUtc(chileTodayYmd()).start : d;
  };
  const start = parseFrom(fromParam);
  const end = toParam ? (isNaN(new Date(toParam).getTime()) ? new Date() : new Date(toParam)) : new Date();

  const byMethod: Record<string, { amount: number; tip: number; count: number }> = {};
  const add = (method: string, amount: number, tip: number) => {
    if (!byMethod[method]) byMethod[method] = { amount: 0, tip: 0, count: 0 };
    byMethod[method].amount += amount;
    byMethod[method].tip += tip;
    byMethod[method].count += 1;
  };

  // ── PosOrder (Centro de pedidos) — por FECHA DE COBRO ──
  // El cobro bumpea updatedAt y guarda el instante exacto en rawPayload.posPayment.at.
  // Filtramos por eso (NO por createdAt): un pedido viejo cobrado hoy cuenta hoy.
  const pos = await prisma.posOrder.findMany({
    where: { restaurantId, posStatus: { not: "canceled" }, paidAmount: { gt: 0 }, updatedAt: { gte: start, lte: end } },
    select: { totalAmount: true, paidAmount: true, tipAmount: true, vendorName: true, rawPayload: true, updatedAt: true },
  });
  for (const o of pos) {
    const amount = o.totalAmount || 0;
    if (amount <= 0 || (o.paidAmount || 0) < amount) continue; // solo pagados
    const rp = (o.rawPayload && typeof o.rawPayload === "object" && !Array.isArray(o.rawPayload)) ? o.rawPayload as Record<string, any> : {};
    // Fecha de cobro: posPayment.at (cobrado en caja) o updatedAt (fallback).
    const paidAtIso = rp?.posPayment?.at as string | undefined;
    const paidDate = paidAtIso ? new Date(paidAtIso) : o.updatedAt;
    if (paidDate < start || paidDate > end) continue;
    const platform = platformLabel(o.vendorName);
    const tip = o.tipAmount || 0;
    const parts = Array.isArray(rp?.posPayment?.parts) ? rp.posPayment.parts.filter((pp: any) => (Number(pp?.amount) || 0) > 0) : [];
    if (!platform && parts.length > 1) {
      // Pago combinado: reparte cada parte en su método; la propina va al primero.
      parts.forEach((pp: any, i: number) => add(normMethod(pp?.method), Number(pp?.amount) || 0, i === 0 ? tip : 0));
    } else {
      const method = platform ?? normMethod(parts[0]?.method || rp?.posPayment?.method || rp?.webPayment?.method);
      add(method, amount, tip);
    }
  }

  // NOTA: el arqueo NO incluye ventas de ecommerce nativo (OnlineOrder). Un local
  // puede tener su propio POS (p.ej. Hand Roll usa Toteat) donde las ventas del
  // ecommerce a propósito NO se ingresan. El cierre de caja refleja solo lo que
  // pasó por el POS (PosOrder / Centro de pedidos) + las cuentas event-sourced.

  let total = 0, tips = 0, count = 0;
  for (const v of Object.values(byMethod)) { total += v.amount; tips += v.tip; count += v.count; }

  return NextResponse.json({ byMethod, total, tips, count }, { headers: { "Cache-Control": "no-store" } });
}
