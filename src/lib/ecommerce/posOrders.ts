// ═══════════════════════════════════════════════════════════
//  Parseo de pedidos de Toteat (webhook entrante → PosOrder).
//  Portado de la implementación PHP de deliveryhandroll, adaptado
//  a multitenant (un local por token) y a montos enteros (CLP).
// ═══════════════════════════════════════════════════════════

type AnyObj = Record<string, any>;

/** Extrae la lista de pedidos del payload, tolerando las formas que manda Toteat:
 *  { data: [...] } | { data: { orders: [...] } } | [...] | { ...un pedido }. */
export function extractOrders(payload: unknown): AnyObj[] {
  const isList = (a: unknown): a is any[] => Array.isArray(a);
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const o = payload as AnyObj;
    if (o.data !== undefined) {
      if (isList(o.data)) return o.data;
      if (o.data && typeof o.data === "object" && isList(o.data.orders)) return o.data.orders;
      return [];
    }
    return [o];
  }
  if (isList(payload)) return payload;
  return [];
}

function round100(x: number): number {
  return Math.round(x / 100) * 100;
}

/** ¿El pago es en efectivo? Toteat manda paymentType=1000 (numérico) o un nombre. */
function isCash(p: AnyObj): boolean {
  const pt = p?.paymentType;
  if (pt != null && !isNaN(Number(pt)) && Number(pt) === 1000) return true;
  const name = String(p?.name ?? p?.type ?? p?.paymentName ?? "").toLowerCase();
  return name !== "" && (name.includes("efect") || name.includes("cash"));
}

/** Propina/vuelto con la misma fórmula que la app de repartidores. Trabaja sobre el
 *  sobrepago (amountPaid - amount) sin restar delivery (amount ya lo incluye). */
function tipChange(payments: AnyObj[], saleType: string | null): { tip: number; change: number } {
  let tip = 0, change = 0;
  for (const p of payments || []) {
    if (!p || typeof p !== "object") continue;
    const amount = Number(p.amount ?? 0);
    const amountPaid = Number(p.amountPaid ?? 0);
    if (amount <= 0 || amountPaid <= 0) continue;
    const diff = amountPaid - amount;
    if (diff <= 0) continue;

    // Efectivo: el sobrepago es SIEMPRE vuelto, nunca propina.
    if (isCash(p)) { change += diff; continue; }

    const type = String(saleType ?? "").toLowerCase();
    if (type === "order") {
      const suggested = round100(amount * 0.10);
      if (diff >= suggested - 50) { tip += Math.max(0, suggested); change += Math.max(0, diff - suggested); }
      else tip += diff;
    } else {
      const threshold = amount * 0.15;
      if (diff <= threshold) tip += diff;
      else change += diff;
    }
  }
  return { tip: Math.max(0, tip), change: Math.max(0, change) };
}

/** Descuentos: document.payments[].commission[].value negativo. */
function calcDiscount(ord: AnyObj): number {
  let discount = 0;
  const doc = ord?.document && typeof ord.document === "object" ? ord.document : {};
  const payments = doc.payments ?? ord.payments ?? [];
  if (!Array.isArray(payments)) return 0;
  for (const p of payments) {
    const comms = p?.commission ?? [];
    if (!Array.isArray(comms)) continue;
    for (const c of comms) {
      const val = Number(c?.value ?? 0);
      if (val < 0) discount += Math.abs(val);
    }
  }
  return discount;
}

const STATUS_ID_MAP: Record<string, string> = {
  "0": "new", "1": "created", "2": "preparing", "3": "ready", "4": "ondelivery",
  "5": "delivered", "6": "canceled", "90": "printed", "160": "closed", "200": "closed",
};
const STATUS_MAP: Record<string, string> = {
  new: "new", created: "new", preparing: "preparing", ready: "preparing",
  ondelivery: "on_the_way", on_delivery: "on_the_way", on_the_way: "on_the_way",
  delivered: "delivered", canceled: "canceled", cancelled: "canceled",
  accepted: "accepted", printed: "accepted", closed: "accepted",
};

export interface MappedPosOrder {
  externalId: string;
  posStatus: string;
  saleType: string;
  isDelivery: boolean;
  tableLabel: string | null;
  customerName: string;
  customerPhone: string;
  addressLine: string;
  totalAmount: number;
  paidAmount: number;
  tipAmount: number;
  changeAmount: number;
  deliveryFee: number;
  discountAmount: number;
  currency: string;
  vendorName: string | null;
  orderReference: string | null;
  items: any;
  completedAt: Date | null;
}

/** Mapea un pedido crudo de Toteat al shape de PosOrder. Devuelve null si no parece pedido. */
export function mapToteatOrder(ord: AnyObj): MappedPosOrder | null {
  if (!ord || typeof ord !== "object") return null;

  let externalId = String(ord.orderId ?? ord.id ?? ord.orderReference ?? "");

  // ── Estado ──
  let statusRaw = ord.status ?? ord.deliveryStatus ?? ord.deliveryStatusId ?? "new";
  statusRaw = typeof statusRaw === "string" ? statusRaw.toLowerCase() : String(statusRaw);
  if (/^\d+$/.test(statusRaw)) statusRaw = STATUS_ID_MAP[statusRaw] ?? "new";
  const posStatus = STATUS_MAP[statusRaw] ?? "new";

  // ── Cliente / dirección ──
  const doc = ord.document && typeof ord.document === "object" ? ord.document : {};
  const dc = doc.customer && typeof doc.customer === "object" ? doc.customer : {};
  let customerName = String(ord.customer?.name ?? ord.client?.name ?? ord.buyer?.fullName ?? "");
  let customerPhone = String(ord.customer?.phone ?? ord.client?.phone ?? ord.buyer?.phone ?? "");
  let addressLine = String(ord.delivery?.address?.full ?? ord.deliveryAddress ?? ord.address ?? "");
  if (!customerName && dc) customerName = String(dc.name ?? dc.fullName ?? "");
  if (!customerPhone && dc) customerPhone = String(dc.phoneNumber ?? dc.phoneNumber1 ?? dc.phoneNumber2 ?? "");
  if (dc?.delivery && typeof dc.delivery === "object") {
    const del = dc.delivery;
    const parts: string[] = [];
    for (const k of ["address", "officeOrApt", "location", "city", "postalCode"]) if (del[k]) parts.push(String(del[k]));
    const built = parts.join(", ").trim();
    if (built) addressLine = built;
  }

  // ── Mesa ──
  let tableLabel: string | null = null;
  if (!addressLine && Array.isArray(ord.tableId)) {
    const pos = ord.tableId.filter((n: any) => !isNaN(Number(n)) && Number(n) > 0);
    if (pos.length) tableLabel = "Mesa " + pos.map(String).join(",");
  }

  const vendorName = String(ord.vendorName ?? "").trim() || null;
  const orderReference = String(ord.orderReference ?? "").trim() || null;

  // ── Tipo de venta ──
  let saleType = ord.type != null ? String(ord.type).toLowerCase() : "";
  if (saleType === "" && Array.isArray(ord.tableId)) {
    const hasPos = ord.tableId.some((n: any) => !isNaN(Number(n)) && Number(n) > 0);
    const hasNeg = ord.tableId.some((n: any) => !isNaN(Number(n)) && Number(n) < 0);
    if (hasPos) saleType = "dine-in";
    else if (hasNeg) saleType = "delivery";
  }
  if (saleType === "" && addressLine) saleType = "delivery";

  // ── Ítems ──
  let items = ord.items ?? ord.orderItems ?? ord.products ?? null;
  if (items == null && Array.isArray(doc.line)) items = doc.line;

  // ── Delivery fee (línea de reparto) ──
  let deliveryFee = 0;
  if (Array.isArray(items)) {
    for (const ln of items) {
      if (!ln || typeof ln !== "object") continue;
      const name = String(ln.productName ?? ln.name ?? "").toLowerCase();
      const code = String(ln.productCode ?? "").toUpperCase();
      const isDeliveryLine = name.includes("delivery") || name.includes("reparto") || name.includes("envio") || name.includes("envío") || code === "TOTEATDVYCOST";
      if (isDeliveryLine) {
        let qty = ln.quantity != null ? Number(ln.quantity) : 1;
        if (qty <= 0) qty = 1;
        if (ln.amountAfterTax != null) deliveryFee += Number(ln.amountAfterTax);
        else if (ln.unitPriceAfterTax != null) deliveryFee += Number(ln.unitPriceAfterTax) * qty;
        else if (ln.unitPrice != null) deliveryFee += Number(ln.unitPrice) * qty;
      }
    }
  }

  // ── Montos ──
  let sumBase = 0, sumPaid = 0, sumCashOver = 0;
  const payments = Array.isArray(doc.payments) ? doc.payments : [];
  for (const p of payments) {
    if (!p || typeof p !== "object") continue;
    const pBase = Number(p.amount ?? 0);
    const pPaid = Number(p.amountPaid ?? 0);
    sumBase += pBase;
    if (isCash(p) && pPaid > pBase) { sumPaid += pBase; sumCashOver += pPaid - pBase; }
    else sumPaid += pPaid;
  }
  let totalAmount = sumBase;
  if (totalAmount <= 0 && Array.isArray(items)) {
    let suma = 0;
    for (const ln of items) {
      if (!ln || typeof ln !== "object") continue;
      if (ln.amountAfterTax != null) suma += Number(ln.amountAfterTax);
      else if (ln.unitPriceAfterTax != null && ln.quantity != null) suma += Number(ln.unitPriceAfterTax) * Number(ln.quantity);
    }
    if (suma > 0) totalAmount = suma;
  }
  const { tip, change } = tipChange(payments, saleType || (ord.type ?? null));
  const changeAmount = change > 0 ? change : sumCashOver;
  const isDelivery = deliveryFee > 0 || saleType === "delivery";

  // ── completedAt ──
  const completedRaw = ord.completedAt ?? ord.completed_at ?? ord.deliveredAt ?? ord.closedAt ?? doc.closingDate ?? null;
  let completedAt: Date | null = null;
  if (completedRaw) {
    const d = new Date(typeof completedRaw === "number" || /^\d+$/.test(String(completedRaw)) ? Number(completedRaw) * (String(completedRaw).length <= 10 ? 1000 : 1) : String(completedRaw));
    if (!isNaN(d.getTime())) completedAt = d;
  }
  if (!completedAt && posStatus === "delivered") completedAt = new Date();

  const discountAmount = calcDiscount(ord);

  const parecePedido = externalId !== "" || (Array.isArray(items) && items.length > 0) || !!customerName || !!addressLine;
  if (!parecePedido) return null;
  if (externalId === "") externalId = "toteat_" + Math.random().toString(36).slice(2, 14);

  const r = (n: number) => Math.round(n) || 0;
  return {
    externalId,
    posStatus,
    saleType,
    isDelivery,
    tableLabel,
    customerName,
    customerPhone,
    addressLine,
    totalAmount: r(totalAmount),
    paidAmount: r(sumPaid),
    tipAmount: r(tip),
    changeAmount: r(changeAmount),
    deliveryFee: r(deliveryFee),
    discountAmount: r(discountAmount),
    currency: String(ord.totals?.currency ?? ord.currency ?? "CLP"),
    vendorName,
    orderReference,
    items: items ?? null,
    completedAt,
  };
}
