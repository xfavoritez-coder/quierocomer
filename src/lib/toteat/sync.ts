/**
 * Syncs Toteat sales for one restaurant into the local cache tables
 * (ToteatSale + ToteatSaleProduct). Idempotent: re-running on the same
 * window upserts by toteatOrderId.
 */

import { prisma } from "@/lib/prisma";
import { fetchToteatSales, ToteatCredentials } from "./fetchSales";
import { parseToteatDate, chileTodayYYYYMMDD, chileDateOf } from "./timezone";

interface SyncResult {
  restaurantId: string;
  ok: boolean;
  upserted: number;
  skipped: number;
  rangeIni: string;
  rangeEnd: string;
  error?: string;
}

function fmt(d: Date) {
  return chileDateOf(d).replace(/-/g, "");
}

function clampDays(from: Date, to: Date, maxDays: number): { ini: Date; end: Date } {
  const diffMs = to.getTime() - from.getTime();
  const maxMs = maxDays * 24 * 60 * 60 * 1000;
  if (diffMs <= maxMs) return { ini: from, end: to };
  return { ini: new Date(to.getTime() - maxMs), end: to };
}

export async function syncRestaurantSales(opts: {
  restaurantId: string;
  credentials: ToteatCredentials;
  from?: Date | null;
  to?: Date | null;
}): Promise<SyncResult> {
  const out: SyncResult = {
    restaurantId: opts.restaurantId,
    ok: false,
    upserted: 0,
    skipped: 0,
    rangeIni: "",
    rangeEnd: "",
  };

  const today = new Date();
  const fromDate = opts.from || new Date(today.getTime() - 24 * 60 * 60 * 1000); // last 24h default
  const toDate = opts.to || today;
  const range = clampDays(fromDate, toDate, 14); // Toteat caps at 15 days; stay safe

  const ini = fmt(range.ini);
  const end = fmt(range.end);
  out.rangeIni = ini;
  out.rangeEnd = end;

  const resp = await fetchToteatSales({ ini, end, credentials: opts.credentials });
  if (resp.ok === false || !resp.data) {
    out.error = typeof resp.msg === "string" ? resp.msg : resp.msg?.texto || "Toteat error";
    return out;
  }

  for (const sale of resp.data) {
    const dateOpen = parseToteatDate(sale.dateOpen);
    const dateClosed = parseToteatDate(sale.dateClosed);
    if (!dateOpen || !dateClosed) {
      out.skipped++;
      continue;
    }

    const data = {
      restaurantId: opts.restaurantId,
      toteatOrderId: BigInt(sale.orderId),
      toteatTableId: sale.tableId ?? null,
      toteatTableName: sale.tableName ?? null,
      numberClients: sale.numberClients ?? null,
      toteatWaiterId: sale.waiterId ? BigInt(sale.waiterId) : null,
      waiterName: sale.waiterName ?? null,
      dateOpen,
      dateClosed,
      total: sale.total ?? 0,
      payed: sale.payed ?? 0,
      gratuity: sale.gratuity ?? 0,
      subtotal: sale.subtotal ?? 0,
      taxes: sale.taxes ?? 0,
      fiscalType: sale.fiscalType || null,
      paymentMethod: sale.paymentForms?.[0]?.method || null,
      rawJson: sale as any,
      syncedAt: new Date(),
    };

    const upserted = await prisma.toteatSale.upsert({
      where: { toteatOrderId: BigInt(sale.orderId) },
      create: data,
      update: data,
    });

    // Replace products on every upsert (cheaper than diff for small N)
    await prisma.toteatSaleProduct.deleteMany({ where: { saleId: upserted.id } });
    if (sale.products && sale.products.length > 0) {
      await prisma.toteatSaleProduct.createMany({
        data: sale.products.map((p) => ({
          saleId: upserted.id,
          toteatProductId: p.id,
          productName: p.name,
          hierarchyId: p.hierarchyId || null,
          hierarchyName: p.hierarchyName || null,
          quantity: p.quantity ?? 0,
          netPrice: p.netPrice ?? 0,
          payed: p.payed ?? 0,
          taxes: p.taxes ?? 0,
          discounts: p.discounts ?? 0,
        })),
      });
    }
    out.upserted++;
  }

  await prisma.restaurant.update({
    where: { id: opts.restaurantId },
    data: { toteatLastSyncAt: new Date() },
  });

  out.ok = true;
  return out;
}

export async function loadCredentialsFromRestaurant(restaurantId: string, fallbackToEnv = false): Promise<ToteatCredentials | null> {
  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { toteatRestaurantId: true, toteatLocalId: true, toteatUserId: true, toteatApiToken: true },
  });
  if (r?.toteatRestaurantId && r.toteatLocalId !== null && r.toteatUserId !== null && r.toteatApiToken) {
    return {
      base: process.env.TOTEAT_API_BASE || "https://api.toteat.com/mw/or/1.0",
      xir: r.toteatRestaurantId,
      xil: r.toteatLocalId!,
      xiu: r.toteatUserId!,
      token: r.toteatApiToken,
    };
  }
  if (fallbackToEnv) {
    const base = process.env.TOTEAT_API_BASE;
    const xir = process.env.TOTEAT_RESTAURANT_ID;
    const xil = process.env.TOTEAT_LOCAL_ID;
    const xiu = process.env.TOTEAT_USER_ID;
    const token = process.env.TOTEAT_API_TOKEN;
    if (base && xir && xil && xiu && token) return { base, xir, xil, xiu, token };
  }
  return null;
}

// Re-export for routes
export { chileTodayYYYYMMDD };
