/**
 * Agrega categorías financieras faltantes para Horus Vegan.
 * Ejecutar: npx tsx scripts/seed-financial-missing.ts
 *
 * - No elimina categorías existentes
 * - Salta si el nombre ya existe para ese restaurantId
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const HORUS_ID = "cmo31qnls0000k004o6ry1wgq";

type CatDef = {
  name: string;
  type: "INCOME" | "EXPENSE";
  group: string;
  icon: string;
  color: string;
  position: number;
};

const MISSING: CatDef[] = [
  // ── Proveedores (additions) ──────────────────────────────────────────────
  { name: "Verduras",    type: "EXPENSE", group: "Proveedores",     icon: "🥦", color: "#22c55e", position: 20 },
  { name: "Tofu",        type: "EXPENSE", group: "Proveedores",     icon: "🫘", color: "#22c55e", position: 21 },
  { name: "Champiñón",   type: "EXPENSE", group: "Proveedores",     icon: "🍄", color: "#22c55e", position: 22 },
  { name: "Brugga",      type: "EXPENSE", group: "Proveedores",     icon: "🍺", color: "#22c55e", position: 23 },

  // ── Marketing (nuevo grupo) ──────────────────────────────────────────────
  { name: "Mercat",             type: "EXPENSE", group: "Marketing", icon: "📣", color: "#8b5cf6", position: 0 },
  { name: "Brevo",              type: "EXPENSE", group: "Marketing", icon: "📣", color: "#8b5cf6", position: 1 },
  { name: "Fiweex",             type: "EXPENSE", group: "Marketing", icon: "📣", color: "#8b5cf6", position: 2 },
  { name: "Resos",              type: "EXPENSE", group: "Marketing", icon: "📣", color: "#8b5cf6", position: 3 },
  { name: "HappyCow",           type: "EXPENSE", group: "Marketing", icon: "📣", color: "#8b5cf6", position: 4 },
  { name: "Meta Ads",           type: "EXPENSE", group: "Marketing", icon: "📣", color: "#8b5cf6", position: 5 },
  { name: "Community manager",  type: "EXPENSE", group: "Marketing", icon: "📣", color: "#8b5cf6", position: 6 },
  { name: "Microsoft",          type: "EXPENSE", group: "Marketing", icon: "📣", color: "#8b5cf6", position: 7 },
  { name: "Influencers",        type: "EXPENSE", group: "Marketing", icon: "📣", color: "#8b5cf6", position: 8 },
  { name: "Chatfuel",           type: "EXPENSE", group: "Marketing", icon: "📣", color: "#8b5cf6", position: 9 },
  { name: "Fujifilm instax",    type: "EXPENSE", group: "Marketing", icon: "📣", color: "#8b5cf6", position: 10 },

  // ── RRHH (nuevo grupo) ───────────────────────────────────────────────────
  { name: "Sueldo personal",      type: "EXPENSE", group: "RRHH", icon: "👥", color: "#ec4899", position: 0 },
  { name: "Previred",             type: "EXPENSE", group: "RRHH", icon: "👥", color: "#ec4899", position: 1 },
  { name: "Bonos",                type: "EXPENSE", group: "RRHH", icon: "👥", color: "#ec4899", position: 2 },
  { name: "Finiquitos",           type: "EXPENSE", group: "RRHH", icon: "👥", color: "#ec4899", position: 3 },
  { name: "Traslados personal",   type: "EXPENSE", group: "RRHH", icon: "👥", color: "#ec4899", position: 4 },
  { name: "Turnos extras",        type: "EXPENSE", group: "RRHH", icon: "👥", color: "#ec4899", position: 5 },
  { name: "Turnos feriados",      type: "EXPENSE", group: "RRHH", icon: "👥", color: "#ec4899", position: 6 },
  { name: "Uniforme personal",    type: "EXPENSE", group: "RRHH", icon: "👥", color: "#ec4899", position: 7 },
  { name: "Recreación",           type: "EXPENSE", group: "RRHH", icon: "👥", color: "#ec4899", position: 8 },

  // ── Inversiones (nuevo grupo) ────────────────────────────────────────────
  { name: "Kojo",                          type: "EXPENSE", group: "Inversiones", icon: "🏗️", color: "#0ea5e9", position: 0 },
  { name: "Nuevas maquinaria",             type: "EXPENSE", group: "Inversiones", icon: "🏗️", color: "#0ea5e9", position: 1 },
  { name: "Nueva decoración y muebles",   type: "EXPENSE", group: "Inversiones", icon: "🏗️", color: "#0ea5e9", position: 2 },
  { name: "Remodelaciones",               type: "EXPENSE", group: "Inversiones", icon: "🏗️", color: "#0ea5e9", position: 3 },

  // ── Dinero temporal (nuevo grupo) ────────────────────────────────────────
  { name: "Delifast",         type: "EXPENSE", group: "Dinero temporal", icon: "💸", color: "#f59e0b", position: 0 },
  { name: "Propina personal", type: "EXPENSE", group: "Dinero temporal", icon: "💸", color: "#f59e0b", position: 1 },
  { name: "Uber direct",      type: "EXPENSE", group: "Dinero temporal", icon: "💸", color: "#f59e0b", position: 2 },
  { name: "Monto delivery",   type: "EXPENSE", group: "Dinero temporal", icon: "💸", color: "#f59e0b", position: 3 },

  // ── Impuestos (nuevo grupo) ──────────────────────────────────────────────
  { name: "IVA",                    type: "EXPENSE", group: "Impuestos", icon: "🏛️", color: "#64748b", position: 0 },
  { name: "Impuesto sobre la renta",type: "EXPENSE", group: "Impuestos", icon: "🏛️", color: "#64748b", position: 1 },

  // ── Amortizaciones (nuevo grupo) ─────────────────────────────────────────
  { name: "Préstamo", type: "EXPENSE", group: "Amortizaciones", icon: "📉", color: "#6b7280", position: 0 },
];

async function main() {
  // Cargar categorías existentes para el restaurante
  const existing = await prisma.financialCategory.findMany({
    where: { restaurantId: HORUS_ID },
    select: { name: true },
  });
  const existingNames = new Set(existing.map(c => c.name));

  let created = 0;
  let skipped = 0;

  for (const cat of MISSING) {
    if (existingNames.has(cat.name)) {
      console.log(`  ⏭  Existe: "${cat.name}" — omitido`);
      skipped++;
      continue;
    }
    await prisma.financialCategory.create({
      data: {
        restaurantId: HORUS_ID,
        name: cat.name,
        type: cat.type,
        group: cat.group,
        icon: cat.icon,
        color: cat.color,
        position: cat.position,
        isActive: true,
      },
    });
    console.log(`  ✅ Creado: "${cat.name}" [${cat.group}]`);
    created++;
  }

  console.log(`\n🎉 Listo: ${created} creadas, ${skipped} omitidas`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
