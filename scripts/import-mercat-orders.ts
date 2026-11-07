/**
 * import-mercat-orders.ts
 * Importa las órdenes históricas de Mercat (CSV) a la tabla PosOrder.
 * Uso: npx ts-node --project tsconfig.scripts.json scripts/import-mercat-orders.ts
 *      o: npx tsx scripts/import-mercat-orders.ts
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Mapeo de nombre CSV → restaurantId ──────────────────────────────
const RESTAURANT_MAP: Record<string, string> = {
  // Recoleta
  "kojo sushi":                                    "cmvcjbx090001jn074i0eg9zu",
  "kojo nikkei":                                   "cmvcjbx090001jn074i0eg9zu",
  "kojo sushi recoleta":                           "cmvcjbx090001jn074i0eg9zu",
  "kojo sushi recoleta - sushi nikkei 100% vegano":"cmvcjbx090001jn074i0eg9zu",
  // La Florida
  "kojo sushi - la florida":                       "cmubc0yoq0001jv041si8zicn",
  "kojo sushi la florida":                         "cmubc0yoq0001jv041si8zicn",
  "kojo sushi la florida - sushi nikkei 100% vegano":"cmubc0yoq0001jv041si8zicn",
};

function resolveRestaurant(name: string): string | null {
  return RESTAURANT_MAP[name.trim().toLowerCase()] ?? null;
}

// ── Parsear fecha "DD-MM-YYYY HH:MM" → Date ─────────────────────────
function parseDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min] = m;
  // Tratar como hora de Santiago (UTC-3 aprox). Usamos offset -03:00 estable.
  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00-03:00`);
}

// ── Parsear CSV con soporte básico de comillas ───────────────────────
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (c === "," && !inQuote) {
      result.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

// ── Mapear estado Mercat → posStatus ────────────────────────────────
function mapStatus(estatus: string): string {
  switch (estatus.toLowerCase().trim()) {
    case "completed": return "delivered";
    case "canceled":  return "canceled";
    case "pending":   return "new";
    case "processing":return "preparing";
    default:          return "delivered";
  }
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  const csvPath = path.resolve(__dirname, "../mercat/orders.csv");
  const raw = fs.readFileSync(csvPath, "utf-8");
  const lines = raw.split(/\r?\n/).filter(Boolean);

  // Encabezados
  const headers = parseCsvLine(lines[0]);
  console.log("Columnas:", headers.join(" | "));

  const rows = lines.slice(1);
  console.log(`Total filas: ${rows.length}`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Procesar en batches pequeños con pausa para no saturar Supabase
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const toInsert: any[] = [];
    for (const line of batch) {
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);

      const restaurantName = cols[0] ?? "";
      const ordenId        = cols[1] ?? "";
      const metodo         = cols[2] ?? "";  // a domicilio | retiro | mesa
      const fechaOrden     = cols[3] ?? "";
      const clienteNombre  = cols[4] ?? "";
      const clienteEmail   = cols[5] ?? "";
      const clienteTel     = cols[6] ?? "";
      // cols[7] = Codigo cupon
      const descuento      = Math.round(parseFloat(cols[8] ?? "0") || 0);
      const montoTotal     = Math.round(parseFloat(cols[9] ?? "0") || 0);
      const metodoPago     = cols[10] ?? "";
      const estatusOrden   = cols[11] ?? "";
      // cols[12] = Plataforma, [13] = Tipo cupon, [14] = Costos del pedido
      const costoDelivery  = Math.round(parseFloat(cols[15] ?? "0") || 0);
      const propina        = Math.round(parseFloat(cols[16] ?? "0") || 0);
      // cols[17] = Subvencion, [18] = Cupon
      const fechaEntrega   = cols[19] ?? "";

      const restaurantId = resolveRestaurant(restaurantName);
      if (!restaurantId) {
        console.warn(`  SKIP sin mapeo: "${restaurantName}" | orden ${ordenId}`);
        skipped++;
        continue;
      }

      const createdAt = parseDate(fechaOrden);
      if (!createdAt) {
        console.warn(`  SKIP fecha inválida: "${fechaOrden}" | orden ${ordenId}`);
        skipped++;
        continue;
      }

      const isDelivery = metodo.toLowerCase().includes("domicilio");
      const isPickup   = metodo.toLowerCase().includes("retiro");
      const saleType   = isDelivery ? "delivery" : isPickup ? "pickup" : "dine-in";
      const posStatus  = mapStatus(estatusOrden);
      // Todos los pedidos históricos de Mercat se marcan como "delivered"
      // para que NO aparezcan en la vista de activos del POS.
      const opsStage   = "delivered";

      const completedAt   = parseDate(fechaEntrega) ?? undefined;
      const opsDeliveredAt = isDelivery && completedAt ? completedAt : undefined;

      // externalId único: "mercat-{restaurantId[0..6]}-{ordenId}"
      const externalId = `mercat-${restaurantId.slice(0, 6)}-${ordenId}`;

      toInsert.push({
        restaurantId,
        externalId,
        provider:      "mercat",
        posStatus,
        opsStage,
        isDelivery,
        saleType,
        customerName:  clienteNombre,
        customerEmail: clienteEmail,
        customerPhone: clienteTel,
        totalAmount:   montoTotal,
        paidAmount:    montoTotal,
        deliveryFee:   costoDelivery,
        tipAmount:     propina,
        discountAmount:descuento,
        vendorName:    "Mercat",
        orderReference: ordenId,
        createdAt,
        completedAt:   completedAt ?? null,
        opsDeliveredAt: opsDeliveredAt ?? null,
        rawPayload: {
          metodo, metodoPago, estatusOrden,
          restaurantName, fechaOrden, fechaEntrega,
        },
      });
    }

    // createMany con skipDuplicates
    try {
      const result = await prisma.posOrder.createMany({ data: toInsert as any, skipDuplicates: true });
      inserted += result.count;
    } catch (e: any) {
      console.error(`  ERROR batch ${i}-${i + BATCH}:`, e.message);
      errors += toInsert.length;
    }
    const pct = Math.round(((i + BATCH) / rows.length) * 100);
    console.log(`  [${pct}%] Batch ${i + 1}-${Math.min(i + BATCH, rows.length)} / ${rows.length} → insertados: ${inserted} | saltados: ${skipped}`);

    // Pausa entre batches para no saturar Supabase
    await sleep(800);
  }

  console.log(`\n\nFinalizado.`);
  console.log(`  Insertados: ${inserted}`);
  console.log(`  Saltados:   ${skipped}`);
  console.log(`  Errores:    ${errors}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
