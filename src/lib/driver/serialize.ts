import type { PosOrder, PosOrderResend } from "@prisma/client";

// ── Fechas en hora local de Chile (formato "YYYY-MM-DD HH:MM:SS", como el PHP) ──
export function tzOffset(ymd: string, tz = "America/Santiago"): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  const s = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).format(d);
  const m = s.match(/GMT([+-]\d{2}:\d{2})/);
  return m ? m[1] : "-03:00";
}

export function chileTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Rango UTC [start, end] que cubre el día `ymd` en hora de Chile. */
export function chileDayRangeUtc(ymd: string): { start: Date; end: Date } {
  const off = tzOffset(ymd);
  return { start: new Date(`${ymd}T00:00:00${off}`), end: new Date(`${ymd}T23:59:59.999${off}`) };
}

/** Date → "YYYY-MM-DD HH:MM:SS" en hora de Chile (o null). */
export function fmtChile(d: Date | null | undefined): string | null {
  if (!d) return null;
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    .formatToParts(d).reduce((a, x) => { a[x.type] = x.value; return a; }, {} as Record<string, string>);
  const hh = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day} ${hh}:${p.minute}:${p.second}`;
}

/** opsStage de PosOrder → status compatible con la app. */
export function opsToStatus(opsStage: string): string {
  if (opsStage === "ready") return "ready_for_delivery";
  return opsStage; // out_for_delivery | delivered | preparing
}

const secDiff = (a: Date | null | undefined, b: Date | null | undefined): number | null =>
  a && b ? Math.max(0, Math.round((b.getTime() - a.getTime()) / 1000)) : null;

/** Serializa un PosOrder (con sus resends) al shape DeliveryOrder que espera la app. */
export function serializeOrder(o: PosOrder & { resends?: PosOrderResend[] }, origin: string) {
  const resends = o.resends || [];
  const resendExtra = resends.reduce((s, r) => s + (r.extraDeliveryAmount || 0), 0);
  const lastResend = resends.length ? resends.reduce((a, b) => (b.createdAt > a.createdAt ? b : a)) : null;
  const tip = o.tipAmount || 0;
  const fee = o.deliveryFee || 0;
  const driverEarnings = fee + tip + resendExtra;
  const token = o.trackingToken || "";

  return {
    id: o.id,
    order_id: o.id,
    external_id: o.externalId,
    customer_name: o.customerName || "",
    customer_phone: (o.customerPhone || "").replace(/\s+/g, ""),
    address_line: o.addressLine || "",
    customer_lat: o.customerLat ?? null,
    customer_lng: o.customerLng ?? null,
    notes: "",
    total_amount: o.totalAmount || 0,
    delivery_fee: fee,
    real_tip_amount: tip,
    real_change_amount: o.changeAmount || 0,
    real_delivery_tip_total: fee + tip,
    real_order_total: o.totalAmount || 0,
    resend_count: resends.length,
    resend_extra_delivery: resendExtra,
    resend_responsible_name: lastResend?.responsibleName || "",
    driver_earnings_total: driverEarnings,
    status: opsToStatus(o.opsStage),
    assigned_to: o.assignedTo || "",
    ready_at: fmtChile(o.opsReadyForDeliveryAt),
    dispatched_at: fmtChile(o.opsDispatchedAt),
    delivered_at: fmtChile(o.opsDeliveredAt),
    order_created_at: fmtChile(o.createdAt),
    ops_ready_for_delivery_at: fmtChile(o.opsReadyForDeliveryAt),
    ops_dispatched_at: fmtChile(o.opsDispatchedAt),
    ops_delivered_at: fmtChile(o.opsDeliveredAt),
    tracking_token: token,
    tracking_url: token ? `${origin}/track/${token}` : null,
    tracking_last_ping_at: fmtChile(o.trackingLastPingAt),
    last_lat: o.lastLat ?? null,
    last_lng: o.lastLng ?? null,
    ops_stage: o.opsStage,
    sec_delivery: secDiff(o.opsDispatchedAt, o.opsDeliveredAt),
    sec_total: secDiff(o.createdAt, o.completedAt),
  };
}

export type SerializedOrder = ReturnType<typeof serializeOrder>;

/** Estadísticas del dashboard + payout del repartidor (fórmula del PHP:
 *  gross = Σ driver_earnings_total; −400/pedido; −5% caja). */
export function dashboardStats(mine: SerializedOrder[], done: SerializedOrder[]) {
  const all = [...mine, ...done];
  const ordersCount = all.length;
  const secDeliv = all.map((o) => o.sec_delivery).filter((n): n is number => n != null);
  const secTot = all.map((o) => o.sec_total).filter((n): n is number => n != null);
  const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : 0);
  const gross = all.reduce((s, o) => s + o.driver_earnings_total, 0);
  const base = Math.max(0, gross - ordersCount * 400);
  const driverPay = Math.max(0, Math.round(base - base * 0.05));
  return {
    orders_count: ordersCount,
    avg_delivery_sec: avg(secDeliv),
    avg_total_sec: avg(secTot),
    sum_delivery_tip: gross,
    driver_pay: driverPay,
  };
}
