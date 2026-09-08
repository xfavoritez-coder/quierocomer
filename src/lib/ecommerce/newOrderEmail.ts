import { prisma } from "@/lib/prisma";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";
import { clp } from "@/lib/ecommerce/format";

const PAY_LABEL: Record<string, string> = {
  webpay: "Webpay", flow: "Flow", mercadopago: "MercadoPago",
  efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta (al recibir)",
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

type OrderItem = { name?: string; dishName?: string; quantity?: number; unit_price?: number; unitTotal?: number; selectedOptions?: { optionName?: string }[] };

/**
 * Envía un correo al local avisando de un pedido nuevo (cliente, monto, medio de pago,
 * items, entrega). Best-effort. Solo envía si el local configuró orderNotifyEmail.
 */
export async function sendNewOrderEmailToStore(orderId: string): Promise<void> {
  try {
    const o = await prisma.onlineOrder.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true, customerName: true, customerPhone: true, customerEmail: true,
        orderType: true, deliveryAddress: true, total: true, deliveryFee: true,
        paymentMethod: true, paymentStatus: true, items: true, notes: true, createdAt: true,
        restaurant: { select: { name: true, ecommerceStoreConfig: true, cartaAccentColor: true } },
      },
    });
    if (!o) return;
    const cfg = parseStoreConfig(o.restaurant.ecommerceStoreConfig, { accent: o.restaurant.cartaAccentColor });
    const to = cfg.orderNotifyEmail;
    if (!to) return; // el local no configuró correo de avisos

    const resendKey = process.env.RESEND_API_KEY;
    const num = o.orderNumber != null ? `#${o.orderNumber}` : "";
    const isDelivery = o.orderType === "DELIVERY";
    const paid = o.paymentStatus === "paid";
    const payLabel = PAY_LABEL[o.paymentMethod] || o.paymentMethod || "—";
    const fee = o.deliveryFee || 0;
    const subtotal = Math.max(0, o.total - fee);
    const items = Array.isArray(o.items) ? (o.items as OrderItem[]) : [];
    const accent = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(cfg.primaryColor) ? cfg.primaryColor : "#e63946";

    const itemsHtml = items.map((it) => {
      const name = esc(String(it.name || it.dishName || "Producto"));
      const qty = Number(it.quantity) || 1;
      const opts = Array.isArray(it.selectedOptions) ? it.selectedOptions.map((op) => op?.optionName).filter(Boolean) : [];
      const optStr = opts.length ? ` <span style="color:#888">(${esc(opts.join(", "))})</span>` : "";
      return `<tr><td style="padding:4px 0;color:#222">${qty}× ${name}${optStr}</td></tr>`;
    }).join("");

    const row = (label: string, value: string, strong = false) =>
      `<tr><td style="padding:3px 0;color:#666">${esc(label)}</td><td style="padding:3px 0;text-align:right;color:#111;${strong ? "font-weight:800" : ""}">${value}</td></tr>`;

    const panelUrl = "https://quierocomer.com/panel/ecommerce/pedidos";
    const subject = `🛎️ Nuevo pedido ${num} · ${clp(o.total)} · ${o.restaurant.name}`;
    const html = `
      <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#222;font-size:15px;line-height:1.55;max-width:560px;margin:0 auto;padding:24px 20px">
        <p style="margin:0 0 2px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:.5px;font-weight:800">${esc(o.restaurant.name)}</p>
        <h1 style="margin:0 0 4px;font-size:22px;color:#111">Nuevo pedido ${esc(num)}</h1>
        <p style="margin:0 0 18px;color:#888;font-size:13px">${new Date(o.createdAt).toLocaleString("es-CL", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}</p>

        <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
          ${row("Cliente", esc(o.customerName))}
          ${row("Teléfono", esc(o.customerPhone || "—"))}
          ${o.customerEmail ? row("Correo", esc(o.customerEmail)) : ""}
          ${row("Entrega", isDelivery ? `Delivery${o.deliveryAddress ? " · " + esc(o.deliveryAddress) : ""}` : "Retiro en el local")}
          ${row("Medio de pago", `${esc(payLabel)} · ${paid ? "Pagado ✅" : "Por pagar"}`)}
        </table>

        <div style="border-top:1px solid #eee;border-bottom:1px solid #eee;padding:12px 0;margin:0 0 12px">
          <table style="width:100%;border-collapse:collapse">${itemsHtml}</table>
        </div>

        <table style="width:100%;border-collapse:collapse;margin:0 0 20px">
          ${row("Subtotal", clp(subtotal))}
          ${fee ? row("Despacho", clp(fee)) : ""}
          ${row("Total", clp(o.total), true)}
        </table>

        ${o.notes ? `<p style="margin:0 0 18px;padding:10px 12px;background:#faf7f0;border-radius:8px;color:#555;font-size:14px"><b>Nota:</b> ${esc(o.notes)}</p>` : ""}

        <a href="${panelUrl}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-weight:800;font-size:14px;padding:12px 24px;border-radius:10px">Ver en el panel</a>
      </div>`;
    const text = `Nuevo pedido ${num} en ${o.restaurant.name}\nCliente: ${o.customerName} · ${o.customerPhone || "—"}\nEntrega: ${isDelivery ? "Delivery " + (o.deliveryAddress || "") : "Retiro"}\nPago: ${payLabel} (${paid ? "Pagado" : "Por pagar"})\nTotal: ${clp(o.total)}\n\nVer en el panel: ${panelUrl}`;

    if (!resendKey) { console.log(`[new order email dev] to=${to} ${subject}`); return; }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({ from: process.env.FROM_EMAIL || "QuieroComer <noreply@quierocomer.com>", to, subject, html, text }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) console.error("[new order email] Resend error:", await res.json().catch(() => ({})));
  } catch (e) {
    console.error("[new order email] error:", e);
  }
}
