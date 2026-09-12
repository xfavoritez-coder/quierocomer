"use client";
// ═══════════════════════════════════════════════════════════
//  Comanda térmica del pedido (ecommerce). Se renderiza oculto en
//  pantalla y, al imprimir (window.print()), el CSS deja visible SOLO
//  este ticket. Ancho configurable 58/80 mm. Para impresión automática
//  y silenciosa, Chrome debe abrirse con --kiosk-printing en el local.
// ═══════════════════════════════════════════════════════════

export interface ComandaOrder {
  id: string;
  orderNumber?: number | null;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string | null;
  orderType: "PICKUP" | "DELIVERY";
  deliveryAddress?: string | null;
  paymentMethod: string;
  paymentStatus?: string;
  items: { dishName?: string; name?: string; quantity: number; unitTotal?: number; unit_price?: number; selectedOptions?: { optionName: string }[]; notes?: string }[];
  total: number;
  deliveryFee?: number;
  discount?: number;
  couponCode?: string | null;
  notes?: string | null;
  createdAt: string;
}

const PAY_LABEL: Record<string, string> = {
  webpay: "Webpay", flow: "Flow", mercadopago: "MercadoPago",
  efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta",
};
const clp = (n: number) => `$${Math.round(n || 0).toLocaleString("es-CL")}`;

export default function ComandaPrint({ order, storeName, paperWidth = 80 }: { order: ComandaOrder; storeName: string; paperWidth?: 58 | 80 }) {
  const w = paperWidth === 58 ? 58 : 80;
  const items = Array.isArray(order.items) ? order.items : [];
  const subtotal = items.reduce((s, it) => s + (it.unitTotal ?? it.unit_price ?? 0) * it.quantity, 0);
  const created = new Date(order.createdAt).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });
  const num = order.orderNumber ?? order.id.slice(-5);
  const pay = PAY_LABEL[order.paymentMethod] || order.paymentMethod;
  const paid = order.paymentStatus === "paid";

  // Se renderiza dentro de un iframe aislado (solo la comanda), por eso el
  // documento no tiene nada más: no hace falta ocultar el resto. El @page fija
  // el ancho al papel y el alto exacto al contenido (evita el "papel infinito").
  const css = `
    @page { size: ${w}mm auto; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    #comanda-print {
      width: ${w}mm; padding: 3mm 2mm; box-sizing: border-box;
      color: #000; background: #fff;
      font-family: ui-monospace, "Courier New", monospace;
      font-size: ${w === 58 ? "11px" : "12.5px"}; line-height: 1.35;
    }
  `;

  const hr = { borderTop: "1px dashed #000", margin: "6px 0" } as const;
  const row = { display: "flex", justifyContent: "space-between", gap: 6 } as const;

  return (
    <div id="comanda-print">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div style={{ textAlign: "center", fontWeight: 800, fontSize: w === 58 ? "14px" : "16px", textTransform: "uppercase" }}>{storeName}</div>
      <div style={{ textAlign: "center", fontWeight: 700 }}>COMANDA · Pedido #{num}</div>
      <div style={{ textAlign: "center" }}>{created}</div>

      <div style={hr} />

      <div style={{ fontWeight: 800 }}>{order.orderType === "DELIVERY" ? "DELIVERY" : "RETIRO EN LOCAL"}</div>
      <div>{order.customerName}</div>
      {order.customerPhone && <div>Tel: {order.customerPhone}</div>}
      {order.orderType === "DELIVERY" && order.deliveryAddress && <div>Dir: {order.deliveryAddress}</div>}

      <div style={hr} />

      {items.map((it, i) => {
        const name = it.dishName || it.name || "Producto";
        const lineTotal = (it.unitTotal ?? it.unit_price ?? 0) * it.quantity;
        return (
          <div key={i} style={{ marginBottom: 4 }}>
            <div style={row}>
              <span style={{ fontWeight: 700 }}>{it.quantity}x {name}</span>
              <span>{clp(lineTotal)}</span>
            </div>
            {it.selectedOptions?.length ? (
              <div style={{ paddingLeft: 10 }}>{it.selectedOptions.map((o) => `- ${o.optionName}`).join("\n").split("\n").map((l, k) => <div key={k}>{l}</div>)}</div>
            ) : null}
            {it.notes ? <div style={{ paddingLeft: 10, fontStyle: "italic" }}>* {it.notes}</div> : null}
          </div>
        );
      })}

      <div style={hr} />

      {order.total !== subtotal && <div style={row}><span>Subtotal</span><span>{clp(subtotal)}</span></div>}
      {(order.deliveryFee ?? 0) > 0 && <div style={row}><span>Despacho</span><span>{clp(order.deliveryFee!)}</span></div>}
      {(order.discount ?? 0) > 0 && <div style={row}><span>Descuento{order.couponCode ? ` (${order.couponCode})` : ""}</span><span>-{clp(order.discount!)}</span></div>}
      <div style={{ ...row, fontWeight: 800, fontSize: w === 58 ? "13px" : "15px", marginTop: 2 }}><span>TOTAL</span><span>{clp(order.total)}</span></div>

      <div style={hr} />

      <div>Pago: {pay} · {paid ? "PAGADO" : "PENDIENTE"}</div>
      {order.notes ? <div style={{ marginTop: 4 }}>Notas: {order.notes}</div> : null}

      <div style={{ textAlign: "center", marginTop: 8 }}>· · ·</div>
    </div>
  );
}
