/**
 * import-toteat-xls.ts
 * Importa el historial de ventas Toteat (XLS) a la tabla VentaDia.
 *
 * ANTES de correr: ejecutar en Supabase SQL Editor:
 *   ALTER TABLE "VentaDia" ADD COLUMN IF NOT EXISTS "ventaMercat" INTEGER NOT NULL DEFAULT 0;
 *   ALTER TABLE "VentaDia" ADD COLUMN IF NOT EXISTS "ventaUber" INTEGER NOT NULL DEFAULT 0;
 *   ALTER TABLE "VentaDia" ADD COLUMN IF NOT EXISTS "costoDespacho" INTEGER NOT NULL DEFAULT 0;
 *   ALTER TABLE "VentaDia" ADD COLUMN IF NOT EXISTS "margenPct" DOUBLE PRECISION;
 *   ALTER TABLE "VentaDia" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'sync';
 *
 * Uso:
 *   npx tsx scripts/import-toteat-xls.ts --dry-run   ← ver qué importaría sin tocar la BD
 *   npx tsx scripts/import-toteat-xls.ts              ← importación real (80ms entre días, 1.5s entre meses)
 *
 * Puede correrse varias veces (upsert — no duplica).
 */

import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseMonthlyClp(val: unknown): number {
  // Handles both number (in thousands) and string like "$17.853.600"
  if (typeof val === "number") return Math.round(val * 1000);
  if (typeof val === "string") {
    const clean = val.replace(/[^0-9]/g, "");
    return parseInt(clean) || 0;
  }
  return 0;
}

function parseDailyClp(val: unknown): number {
  // Daily values are numbers in thousands
  if (typeof val === "number" && val > 0) return Math.round(val * 1000);
  return 0;
}

function parseDayNumber(label: string): number | null {
  const m = String(label).match(/(\d+)$/);
  return m ? parseInt(m[1]) : null;
}

// ---------------------------------------------------------------------------
// Config per restaurant
// ---------------------------------------------------------------------------

const CONFIGS = [
  {
    restaurantId: "cmvcjbx090001jn074i0eg9zu",
    name: "Kojo Recoleta",
    months: [
      {
        label: "Enero",
        yearMonth: "2026-01",
        file: "Toteat/RECOLETA/Consolidado de ventas/Enero-con.xls",
      },
      {
        label: "Febrero",
        yearMonth: "2026-02",
        file: "Toteat/RECOLETA/Consolidado de ventas/Febrero-con.xls",
      },
      {
        label: "Marzo",
        yearMonth: "2026-03",
        file: "Toteat/RECOLETA/Consolidado de ventas/Marzo-con.xls",
      },
      {
        label: "Abril",
        yearMonth: "2026-04",
        file: "Toteat/RECOLETA/Consolidado de ventas/Abril-con.xls",
      },
      {
        label: "Mayo",
        yearMonth: "2026-05",
        file: "Toteat/RECOLETA/Consolidado de ventas/Mayo-con.xls",
      },
      {
        label: "Junio",
        yearMonth: "2026-06",
        file: "Toteat/RECOLETA/Consolidado de ventas/Junio-con.xls",
      },
      {
        label: "Julio",
        yearMonth: "2026-07",
        file: "Toteat/RECOLETA/Consolidado de ventas/Julio-con.xls",
      },
      {
        label: "Agosto",
        yearMonth: "2026-08",
        file: "Toteat/RECOLETA/Consolidado de ventas/Agosto-con.xls",
      },
      {
        label: "Septiembre",
        yearMonth: "2026-09",
        file: "Toteat/RECOLETA/Consolidado de ventas/Septiembre-con.xls",
      },
    ],
    hasChannels: true, // has UberEats and Mercat rows
  },
  {
    restaurantId: "cmubc0yoq0001jv041si8zicn",
    name: "Kojo La Florida",
    months: [
      {
        label: "Octubre (apertura)",
        yearMonth: "2026-10",
        file: "Toteat/LF/export.xls",
      },
    ],
    hasChannels: false,
  },
];

// ---------------------------------------------------------------------------
// Core processing function
// ---------------------------------------------------------------------------

async function processMonth(
  restaurantId: string,
  restaurantName: string,
  label: string,
  yearMonth: string,
  filePath: string,
  hasChannels: boolean,
  dryRun: boolean
): Promise<void> {
  const [year, monthNum] = yearMonth.split("-").map(Number);

  const wb = XLSX.readFile(path.join(process.cwd(), filePath));
  const ws = wb.Sheets["Sheet1"];
  if (!ws) throw new Error(`Sheet1 not found in ${filePath}`);

  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const headerRow: any[] = rows[0] || [];

  const findRow = (rowLabel: string) =>
    rows.find((r) => String(r[0] || "").trim() === rowLabel);

  const brutaRow = findRow("Venta Bruta");
  const netaRow = findRow("Venta Neta");
  const margenRow = findRow("% Margen Neto");
  const uberRow = hasChannels ? findRow("UberEats") : null;
  const mercatRow = hasChannels ? findRow("Mercat") : null;
  const despachoRow = findRow("Total Costo Despacho");

  if (!brutaRow) {
    console.log(`  ⚠️  No se encontró "Venta Bruta" en ${filePath}`);
    return;
  }

  // Process each day column (skip index 0 = label, skip last = Total)
  let imported = 0;
  let skipped = 0;

  for (let col = 1; col < headerRow.length - 1; col++) {
    const dayLabel = String(headerRow[col] || "");
    const dayNum = parseDayNumber(dayLabel);
    if (!dayNum) continue;

    const bruta = parseDailyClp(brutaRow[col]);
    if (bruta === 0) {
      skipped++;
      continue;
    }

    const neta = parseDailyClp(netaRow?.[col]);
    const rawMargen = margenRow?.[col];
    // skip bogus "1" values — a margin of exactly 1 means "not calculated"
    const margenPct =
      typeof rawMargen === "number" && rawMargen > 1 ? rawMargen : null;
    const uber = hasChannels ? parseDailyClp(uberRow?.[col]) : 0;
    const mercat = hasChannels ? parseDailyClp(mercatRow?.[col]) : 0;
    const despacho = parseDailyClp(despachoRow?.[col]);

    // Build date at noon Santiago time (UTC-3)
    const fecha = new Date(
      `${year}-${String(monthNum).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}T12:00:00-03:00`
    );

    if (dryRun) {
      console.log(
        `  [DRY] ${yearMonth}-${String(dayNum).padStart(2, "0")} bruta=$${bruta.toLocaleString("es-CL")} mercat=$${mercat.toLocaleString("es-CL")} uber=$${uber.toLocaleString("es-CL")}`
      );
      imported++;
      continue;
    }

    try {
      await prisma.ventaDia.upsert({
        where: { restaurantId_fecha: { restaurantId, fecha } },
        create: {
          restaurantId,
          fecha,
          totalBruto: bruta,
          totalNeto: neta || bruta,
          numOrdenes: 0,
          origen: "TOTEAT",
          source: "xls-import",
          ventaMercat: mercat,
          ventaUber: uber,
          costoDespacho: despacho,
          margenPct,
        },
        update: {
          totalBruto: bruta,
          totalNeto: neta || bruta,
          ventaMercat: mercat,
          ventaUber: uber,
          costoDespacho: despacho,
          margenPct,
          source: "xls-import",
        },
      });

      console.log(
        `  ✓ ${yearMonth}-${String(dayNum).padStart(2, "0")} $${bruta.toLocaleString("es-CL")}${mercat ? ` Mercat:$${mercat.toLocaleString("es-CL")}` : ""}${uber ? ` Uber:$${uber.toLocaleString("es-CL")}` : ""}`
      );
      imported++;
    } catch (err: any) {
      console.error(
        `  ✗ ${yearMonth}-${String(dayNum).padStart(2, "0")} ERROR: ${err.message}`
      );
    }

    await sleep(80);
  }

  console.log(
    `  → ${label}: ${imported} días importados, ${skipped} días vacíos omitidos`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("🔍 DRY RUN — no se escribirá nada en la BD\n");

  for (const config of CONFIGS) {
    console.log(`\n📍 ${config.name} (${config.restaurantId})`);

    for (const month of config.months) {
      const fullPath = path.join(process.cwd(), month.file);

      if (!fs.existsSync(fullPath)) {
        console.log(`  ⚠️  Archivo no encontrado: ${month.file}`);
        continue;
      }

      console.log(`\n📅 ${month.label} (${month.yearMonth})`);

      try {
        await processMonth(
          config.restaurantId,
          config.name,
          month.label,
          month.yearMonth,
          month.file,
          config.hasChannels,
          dryRun
        );
      } catch (err: any) {
        console.error(`  ✗ Error en ${month.label}: ${err.message}`);
      }

      if (!dryRun) {
        console.log("  ⏳ Pausa entre meses...");
        await sleep(1500);
      }
    }
  }

  console.log("\n✅ Importación completada.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
