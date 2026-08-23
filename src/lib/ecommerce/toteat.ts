// ═══════════════════════════════════════════════════════════
//  Toteat POS — envío de pedidos del Ecommerce.
//  Portado de Servio (que a su vez sigue la implementación PHP de
//  deliveryhandroll.cl que envía pedidos con éxito a Toteat).
//  Adaptado a quierocomer: credenciales desde ecommerceConfig.pos.toteat.
// ═══════════════════════════════════════════════════════════
import { TOTEAT_DEFAULT_API_URL, type ToteatPosCreds } from "@/lib/ecommerce/config";

export interface PosOrderItemOption {
  value: string;
  price_delta: number;
  toteat_modifier_code?: string | null;
}

export interface PosOrderItem {
  product_name: string;
  quantity: number;
  unit_price: number; // precio unitario ya incluye deltas de las opciones
  toteat_code?: string | null;
  options: PosOrderItemOption[];
}

export interface PosOrder {
  orderNumber: string;
  customerName: string;
  customerPhone: string | null;
  orderType: "PICKUP" | "DELIVERY";
  deliveryAddress: string | null;
  deliveryFee: number;
  notes: string | null;
  total: number;
  paymentMethod: string;
  paymentStatus: string; // "paid" | "pending" | ...
  vendorName?: string; // distintivo de origen que se ve en Toteat (ej: "QC-Hand Roll")
}

export interface ToteatResult {
  ok: boolean;
  toteat_id: string | null;
  message: string;
  raw?: unknown;
}

interface ToteatLine {
  lineNumber: number;
  productCode?: string;
  productName: string;
  quantity: number;
  unitPriceAfterTax: number;
  unitPriceBeforeTax: number;
  amountAfterTax: number;
  amountBeforeTax: number;
  tax: Array<{ name: string; value: number }>;
  isExtra: boolean;
  referenceLine: number | null;
}

/** Construye una línea con IVA (19%). Si amount=0 → tax:[] (Toteat lo exige). */
function buildLine(fields: {
  lineNumber: number;
  productCode?: string;
  productName: string;
  quantity: number;
  amountAfterTax: number;
  isExtra?: boolean;
  referenceLine?: number | null;
}): ToteatLine {
  const after = fields.amountAfterTax;
  const before = after === 0 ? 0 : Math.round((after / 1.19) * 100) / 100;
  const iva = after === 0 ? 0 : Math.round((after - before) * 100) / 100;
  const unitAfter = fields.quantity > 0 ? after / fields.quantity : after;
  const unitBefore = fields.quantity > 0 ? before / fields.quantity : before;
  return {
    lineNumber: fields.lineNumber,
    ...(fields.productCode ? { productCode: fields.productCode } : {}),
    productName: fields.productName,
    quantity: fields.quantity,
    unitPriceAfterTax: Math.round(unitAfter * 100) / 100,
    unitPriceBeforeTax: Math.round(unitBefore * 100) / 100,
    amountAfterTax: after,
    amountBeforeTax: before,
    tax: after === 0 ? [] : [{ name: "IVA", value: iva }],
    isExtra: fields.isExtra ?? false,
    referenceLine: fields.referenceLine ?? null,
  };
}

/** Envía un pedido al POS Toteat. Devuelve el id del pedido en Toteat si tuvo éxito. */
export async function sendOrderToToteat(order: PosOrder, items: PosOrderItem[], creds: ToteatPosCreds): Promise<ToteatResult> {
  const apiUrl = (creds.apiUrl || TOTEAT_DEFAULT_API_URL).replace(/\/$/, "");
  const xir = creds.xir || "";
  const xil = creds.xil || "";
  const xiu = creds.xiu || xil;
  const token = creds.token || "";

  if (!xir || !xil || !token) {
    return { ok: false, toteat_id: null, message: "Toteat no configurado (faltan xir/xil/token)" };
  }

  const isDelivery = order.orderType === "DELIVERY";
  const lines: ToteatLine[] = [];
  let lineNum = 1;
  const itemOptionNotes: string[] = [];

  for (const item of items) {
    const qty = Math.max(1, item.quantity);
    const options = item.options ?? [];
    const parentLine = lineNum;

    // Precio base = unit_price menos la suma de deltas de las opciones.
    const totalDelta = options.reduce((s, o) => s + (o.price_delta ?? 0), 0);
    const basePrice = item.unit_price - totalDelta;

    lines.push(buildLine({
      lineNumber: lineNum++,
      productName: item.product_name,
      quantity: qty,
      amountAfterTax: basePrice * qty,
      ...(item.toteat_code ? { productCode: item.toteat_code } : {}),
      isExtra: false,
      referenceLine: null,
    }));

    // Modificadores: con código Toteat → línea isExtra; sin código → al comentario.
    const withoutCode: string[] = [];
    for (const opt of options) {
      const modName = opt.value || "";
      if (!modName) continue;
      if (opt.toteat_modifier_code) {
        lines.push(buildLine({
          lineNumber: lineNum++,
          productCode: opt.toteat_modifier_code,
          productName: modName,
          quantity: qty,
          amountAfterTax: (opt.price_delta ?? 0) * qty,
          isExtra: true,
          referenceLine: parentLine,
        }));
      } else {
        withoutCode.push(modName);
      }
    }
    if (withoutCode.length) itemOptionNotes.push(`${item.product_name}: ${withoutCode.join(", ")}`);
  }

  // Costo de envío — código oficial Toteat para delivery.
  if (isDelivery && order.deliveryFee > 0) {
    lines.push(buildLine({
      lineNumber: lineNum++,
      productCode: "TOTEATDVYCOST",
      productName: "Delivery",
      quantity: 1,
      amountAfterTax: order.deliveryFee,
      isExtra: false,
      referenceLine: null,
    }));
  }

  // Cliente
  const phoneDigits = parseInt((order.customerPhone ?? "").replace(/\D+/g, ""), 10) || 0;
  const customer: Record<string, unknown> = { name: order.customerName ?? "", phoneNumber: phoneDigits };
  if (isDelivery && order.deliveryAddress) {
    customer.delivery = { address: order.deliveryAddress, city: "Santiago", country: "Chile" };
  }

  // Nota de pago
  const payLabels: Record<string, string> = {
    efectivo: "Efectivo", credito: "Tarjeta crédito", debito: "Tarjeta débito",
    transferencia: "Transferencia", tarjeta: "Tarjeta", webpay: "Webpay", flow: "Flow (online)",
  };
  const payLabel = payLabels[order.paymentMethod] ?? order.paymentMethod.toUpperCase();
  const isPaid = order.paymentStatus === "paid" || ["flow", "webpay"].includes(order.paymentMethod);
  const payNote = isPaid ? `PAGADO: ${payLabel}` : `POR PAGAR: ${payLabel}`;

  let comment = `Pedido ${order.orderNumber} | ${payNote}`;
  if (order.notes) comment += ` | ${order.notes}`;
  if (itemOptionNotes.length) comment += ` | ${itemOptionNotes.join(" | ")}`;

  const now = new Date().toLocaleString("sv-SE", {
    timeZone: "America/Santiago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).replace(" ", "T");

  const payload: Record<string, unknown> = {
    restaurantId: parseInt(xir),
    localNumber: parseInt(xil),
    orderReference: order.orderNumber,
    status: "new",
    type: isDelivery ? "delivery" : "takeaway",
    channel: "webstore",
    vendorName: order.vendorName?.trim() || "QuieroComer",
    comment,
    document: { customer, line: lines },
    operationDate: now,
    modifiedDate: now,
  };

  const url = `${apiUrl}/orders?xir=${xir}&xil=${xil}&xiu=${xiu}&xapitoken=${token}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({} as Record<string, unknown>));

    // Detección de error (equivalente al PHP de referencia).
    const msgTexto = ((data as { msg?: { texto?: string } })?.msg?.texto as string) ?? "";
    const errorsField = (data as { errors?: unknown }).errors;
    const errorsIsNonEmptyArray = Array.isArray(errorsField) && errorsField.length > 0;
    const hasError =
      !res.ok ||
      (data as { ok?: boolean }).ok === false ||
      errorsIsNonEmptyArray ||
      (typeof (data as { error?: string }).error === "string" && (data as { error?: string }).error !== "") ||
      (msgTexto !== "" && /\berror\b/i.test(msgTexto));

    if (!hasError) {
      const d = data as Record<string, unknown> & { data?: Record<string, unknown> };
      const toteatId = String(d.id ?? d.orderId ?? d.data?.id ?? d.data?.orderId ?? "");
      return { ok: true, toteat_id: toteatId || null, message: "OK", raw: data };
    }
    return { ok: false, toteat_id: null, message: msgTexto || `HTTP ${res.status}`, raw: data };
  } catch (err) {
    return { ok: false, toteat_id: null, message: err instanceof Error ? err.message : "Error Toteat" };
  }
}
