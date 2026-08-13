/**
 * Importar datos históricos de flujo.xlsx → FinancialEntry
 * Ejecutar: npx tsx scripts/import-flujo-excel.ts
 *
 * Crea UNA entrada por categoría por mes usando el total mensual de la columna "Totales".
 * Fecha de cada entrada: día 15 del mes correspondiente.
 */
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";

const prisma = new PrismaClient();
const HORUS_ID = "cmo31qnls0000k004o6ry1wgq";

// ── Mapeo: nombre en Excel → nombre de categoría en DB ──────────────────────
// Las filas que no están aquí se ignoran (totales de sección, siempre-cero, etc.)
const INCOME_MAP: Record<string, string> = {
  "Transbank":    "Transbank",
  "Transferencias": "Transferencias",
  "Efectivo":     "Efectivo",
  "Uber":         "Delivery",
};

const EXPENSE_MAP: Record<string, string> = {
  // Materia Prima
  "MP":                         "Materia Prima",
  "Arroz":                      "Materia Prima",
  "Seitan":                     "Materia Prima",
  "Mozzen":                     "Materia Prima",
  "Hod Food":                   "Hod Food",
  "Palta":                      "Palta",
  "Carivo":                     "Carivo",
  "Shen":                       "Shen",
  "Café y Té":                  "Bebestibles",
  "Leche de soya":              "Bebestibles",
  "Bebestibles":                "Bebestibles",
  "Brugga":                     "Bebestibles",
  "Colación":                   "Colación",
  "Empaques y desechables":     "Empaques y desechables",
  "Soyas sachet":               "Empaques y desechables",
  "Servilletas":                "Empaques y desechables",
  "Limpieza e higiene":         "Limpieza e higiene",
  "Postres":                    "Postres",
  // Operaciones
  "Arriendo":                   "Arriendo",
  "Bodega":                     "Arriendo",
  "Electricidad":               "Electricidad",
  "Agua":                       "Agua",
  "Gas":                        "Gas",
  "Toteat":                     "Toteat",
  "Alarma":                     "Alarma / Internet",
  "VTR":                        "Alarma / Internet",
  "Funmigacion":                "Fumigación",
  "Fumigacion":                 "Fumigación",
  "Aroclean":                   "Fumigación",
  "Reposición de vasos":        "Empaques y desechables",
  "Reposición Articulos cocina":"Reparaciones",
  "Reposición articulos salón": "Reparaciones",
  "Reparaciones mano de obra":  "Reparaciones",
  "Reparaciones articulos":     "Reparaciones",
  "Reparaciones maquinaria":    "Reparaciones",
  // Administración
  "Comisiones cuenta corriente":"Comisiones bancarias",
  "Contadora":                  "Contadora",
  "Patentes comerciales":       "Patentes e impuestos",
  "Insumos de oficina":         "Insumos de oficina",
  "Devolución clientes":        "Devolución a clientes",
  "Fee":                        "Fee delivery",
};

const MONTH_MAP: Record<string, number> = {
  "Enero": 1, "Febrero": 2, "Marzo": 3, "Abril": 4,
  "Mayo": 5, "Junio": 6, "Julio": 7, "Agosto": 8,
  "Septiembre": 9, "Octubre": 10, "Noviembre": 11, "Diciembre": 12,
};

function parseCLP(val: unknown): number {
  if (typeof val === "number") return Math.round(val);
  if (typeof val === "string") {
    const n = parseFloat(val.replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? 0 : Math.round(n);
  }
  return 0;
}

async function main() {
  // Cargar categorías de DB → mapa nombre → {id, type}
  const dbCats = await prisma.financialCategory.findMany({
    where: { restaurantId: HORUS_ID, isActive: true },
    select: { id: true, name: true, type: true },
  });
  const catByName = new Map(dbCats.map(c => [c.name, c]));

  // Borrar entradas previas importadas del Excel para evitar duplicados al re-correr
  const deleted = await prisma.financialEntry.deleteMany({
    where: { restaurantId: HORUS_ID, source: "MANUAL", bankMovementId: null },
  });
  if (deleted.count > 0) console.log(`🗑  Borradas ${deleted.count} entradas previas`);

  const wb = XLSX.readFile(path.join(process.cwd(), "flujo.xlsx"));

  let totalCreated = 0;

  for (const sheetName of wb.SheetNames) {
    if (sheetName === "Total") continue;
    const monthNum = MONTH_MAP[sheetName];
    if (!monthNum) { console.log(`⚠  Ignorando hoja "${sheetName}"`); continue; }

    const ws = wb.Sheets[sheetName];
    const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    // Encontrar índice de columna "Totales" (última columna del header)
    const header = rows[0] as (string | number | null)[];
    const totalesIdx = header.lastIndexOf("Totales");
    if (totalesIdx === -1) { console.log(`⚠  Sin columna Totales en "${sheetName}"`); continue; }

    // Fecha representativa: día 15 del mes
    const entryDate = new Date(2026, monthNum - 1, 15, 12, 0, 0);

    // Acumular montos por categoría DB (por si varias filas de Excel → misma categoría)
    const incomeAccum = new Map<string, number>(); // catName → total
    const expenseAccum = new Map<string, number>();

    for (const row of rows.slice(1)) {
      const rawName = row[0];
      if (!rawName || typeof rawName !== "string") continue;
      const name = rawName.trim();

      const total = parseCLP(row[totalesIdx]);
      if (total === 0) continue;

      if (INCOME_MAP[name]) {
        const catName = INCOME_MAP[name];
        incomeAccum.set(catName, (incomeAccum.get(catName) ?? 0) + total);
      } else if (EXPENSE_MAP[name]) {
        const catName = EXPENSE_MAP[name];
        expenseAccum.set(catName, (expenseAccum.get(catName) ?? 0) + total);
      }
      // else: sección total / fila ignorada
    }

    // Crear FinancialEntry para ingresos
    for (const [catName, amount] of incomeAccum) {
      const cat = catByName.get(catName);
      if (!cat) { console.log(`  ⚠  Categoría INCOME no encontrada: "${catName}"`); continue; }
      await prisma.financialEntry.create({
        data: { restaurantId: HORUS_ID, categoryId: cat.id, amount, type: "INCOME", date: entryDate, description: `${sheetName} 2026`, source: "MANUAL" },
      });
      totalCreated++;
    }

    // Crear FinancialEntry para egresos
    for (const [catName, amount] of expenseAccum) {
      const cat = catByName.get(catName);
      if (!cat) { console.log(`  ⚠  Categoría EXPENSE no encontrada: "${catName}"`); continue; }
      await prisma.financialEntry.create({
        data: { restaurantId: HORUS_ID, categoryId: cat.id, amount, type: "EXPENSE", date: entryDate, description: `${sheetName} 2026`, source: "MANUAL" },
      });
      totalCreated++;
    }

    console.log(`✅ ${sheetName}: ${incomeAccum.size} ingresos, ${expenseAccum.size} egresos`);
  }

  console.log(`\n🎉 Total: ${totalCreated} entradas creadas en DB`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
