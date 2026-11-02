// Encoder ESC/POS de la comanda del POS, en el navegador.
// El POS renderiza aquí los bytes crudos y los manda (base64) al agente local,
// que solo los imprime "tal cual" (sin formatear). Impresora 80mm, 48 col.
//
// Portado de print-bridge/src/encoder.js (mismo formato que diseñó el POS).

import type { ComandaPayload, ComandaItem, CashClosePayload } from "./bridge";

const ESC = 0x1b;
const GS = 0x1d;
const WIDTH = 48;

// Normaliza acentos/ñ a ASCII (las térmicas no comparten code page de forma fiable).
function norm(s: string): string {
  return (s || "")
    .replace(/[áàä]/g, "a").replace(/[éèë]/g, "e")
    .replace(/[íìï]/g, "i").replace(/[óòö]/g, "o")
    .replace(/[úùü]/g, "u").replace(/[ÁÀÄ]/g, "A")
    .replace(/[ÉÈË]/g, "E").replace(/[ÍÌÏ]/g, "I")
    .replace(/[ÓÒÖ]/g, "O").replace(/[ÚÙÜ]/g, "U")
    .replace(/ñ/g, "n").replace(/Ñ/g, "N")
    .replace(/[""]/g, '"').replace(/['']/g, "'")
    // cualquier otro no-ASCII restante se descarta (la impresora no lo entiende)
    .replace(/[^\x00-\x7F]/g, "");
}

class Enc {
  private bytes: number[] = [];
  raw(...b: number[]) { for (const x of b) this.bytes.push(x & 0xff); return this; }
  text(s: string) { for (const ch of norm(s)) this.bytes.push(ch.charCodeAt(0) & 0x7f); return this; }
  line(s = "") { this.text(s); this.bytes.push(0x0a); return this; }
  init() { return this.raw(ESC, 0x40); }
  alignLeft() { return this.raw(ESC, 0x61, 0x00); }
  alignCenter() { return this.raw(ESC, 0x61, 0x01); }
  boldOn() { return this.raw(ESC, 0x45, 0x01); }
  boldOff() { return this.raw(ESC, 0x45, 0x00); }
  doubleOn() { return this.raw(GS, 0x21, 0x11); }
  doubleOff() { return this.raw(GS, 0x21, 0x00); }
  lf() { return this.raw(0x0a); }
  cut() { return this.raw(GS, 0x56, 0x42, 0x05); }
  toBytes(): Uint8Array { return Uint8Array.from(this.bytes); }
}

function lineColumns(left: string, right: string, width = WIDTH): string {
  const maxLeft = width - right.length - 1;
  const l = left.substring(0, maxLeft).padEnd(maxLeft, " ");
  return l + " " + right;
}

function wrapText(str: string, width = WIDTH, indent = 0): string {
  const words = str.split(" ");
  const lines: string[] = [];
  let current = " ".repeat(indent);
  for (const word of words) {
    if (current.length + word.length + 1 > width) {
      lines.push(current);
      current = " ".repeat(indent) + word;
    } else {
      current += (current.trim() ? " " : "") + word;
    }
  }
  if (current.trim()) lines.push(current);
  return lines.join("\n");
}

/** Comanda de cocina → bytes ESC/POS crudos. */
export function encodeComanda(c: ComandaPayload): Uint8Array {
  const e = new Enc();
  const now = new Date();
  const hora = now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  const cuenta = c.accountId ? "#" + c.accountId.slice(-4).toUpperCase() : "";

  let titulo = "";
  if (c.type === "mesa") titulo = "MESA " + (c.tableNumber || "?");
  else if (c.type === "retiro") titulo = "RETIRO" + (c.customerName ? " - " + c.customerName.toUpperCase() : "");
  else titulo = "MOSTRADOR";

  // Cabecera
  e.init().alignCenter().doubleOn().line(titulo).doubleOff();

  let subline = hora + "  " + cuenta;
  if (c.type === "retiro" && c.pickupTime) subline = "Retiro: " + c.pickupTime + "  " + hora;
  e.boldOff().line(subline);

  e.alignLeft().line(lineColumns("Garzon: " + (c.sentBy || "sistema"), "Ronda " + (c.roundNumber || 1)));
  e.line("=".repeat(WIDTH));

  // Ítems
  for (const item of (c.items || []) as ComandaItem[]) {
    const qty = String(item.quantity);
    const nameWidth = WIDTH - qty.length - 2;
    const name = (item.dish_name || "").toUpperCase();
    e.boldOn().line(qty + "x " + name.substring(0, nameWidth)).boldOff();

    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        const extra = mod.price_adjustment > 0 ? " (+$" + mod.price_adjustment.toLocaleString("es-CL") + ")" : "";
        e.line(wrapText("  + " + mod.name + extra, WIDTH, 4));
      }
    }
    if (item.note) {
      e.boldOn().line(wrapText("  !! " + item.note.toUpperCase(), WIDTH, 5)).boldOff();
    }
  }

  e.line("-".repeat(WIDTH)).lf().lf().lf().cut();
  return e.toBytes();
}

/** Cierre de caja (arqueo) → bytes ESC/POS crudos. Mismo agente que la comanda. */
export function encodeCashClose(c: CashClosePayload): Uint8Array {
  const e = new Enc();
  const money = (n: number) => "$" + (n || 0).toLocaleString("es-CL");

  // Cabecera
  e.init().alignCenter().doubleOn().line("CIERRE DE CAJA").doubleOff();
  if (c.restaurantName) e.boldOn().line(c.restaurantName).boldOff();
  e.line(c.date);
  e.line("Apertura " + c.openedAt + " - Cierre " + c.closedAt);
  e.alignLeft().line("=".repeat(WIDTH));

  // Ventas por medio de pago
  e.boldOn().line("VENTAS DEL TURNO  (" + (c.closedAccounts || 0) + " cuentas)").boldOff();
  for (const m of c.methods) {
    const right = money(m.amount) + (m.count ? "  (" + m.count + ")" : "");
    e.line(lineColumns(m.label, right));
  }
  e.line("-".repeat(WIDTH));
  e.line(lineColumns("Propinas", money(c.totalTips)));
  e.boldOn().line(lineColumns("TOTAL VENTAS", money(c.totalSales))).boldOff();
  e.line("=".repeat(WIDTH));

  // Arqueo de efectivo
  e.boldOn().line("ARQUEO DE EFECTIVO").boldOff();
  e.line(lineColumns("Apertura", money(c.opening)));
  e.line(lineColumns("Ventas en efectivo", money(c.cashSales)));
  e.line(lineColumns("Efectivo esperado", money(c.expectedCash)));
  if (c.countedCash != null) {
    e.line(lineColumns("Efectivo contado", money(c.countedCash)));
    e.line("-".repeat(WIDTH));
    const diff = c.difference ?? 0;
    const tag = diff === 0 ? "" : diff < 0 ? "  (faltante)" : "  (sobrante)";
    e.boldOn().line(lineColumns("DIFERENCIA", money(Math.abs(diff)) + tag)).boldOff();
  } else {
    e.line("-".repeat(WIDTH));
    e.line("Efectivo no contado");
  }

  if (c.note) {
    e.line("-".repeat(WIDTH));
    e.line(wrapText("Nota: " + c.note, WIDTH, 0));
  }

  e.line("-".repeat(WIDTH)).lf().lf().lf().cut();
  return e.toBytes();
}

/** Comanda de prueba (para el botón "Imprimir prueba"). */
export function encodeTest(): Uint8Array {
  return encodeComanda({
    jobId: "test",
    type: "mesa",
    tableNumber: "5",
    accountId: "ABCD1234",
    roundNumber: 1,
    sentBy: "garzon",
    items: [
      { quantity: 2, dish_name: "Special Roll Salmon", modifiers: [{ name: "Sin palta", price_adjustment: 0 }] },
      { quantity: 1, dish_name: "Gyoza Vegetariana", modifiers: [], note: "Sin salsa de soya por favor" },
    ],
  });
}

/** Bytes → base64 (para mandarlos en el JSON al agente local). */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]);
  }
  return typeof btoa !== "undefined" ? btoa(bin) : Buffer.from(bytes).toString("base64");
}
