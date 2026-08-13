/**
 * Seed FinancialCategory para Horus Vegan
 * + habilita financialEnabled en el restaurante
 * Ejecutar: npx tsx scripts/seed-financial-horus.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const HORUS_ID = "cmo31qnls0000k004o6ry1wgq";

const CATEGORIES = [
  // ── INGRESOS ─────────────────────────────────────────────
  { name: "Transbank", type: "INCOME", color: "#22c55e", icon: "💳", position: 1 },
  { name: "Transferencias", type: "INCOME", color: "#10b981", icon: "🏦", position: 2 },
  { name: "Efectivo", type: "INCOME", color: "#84cc16", icon: "💵", position: 3 },
  { name: "Delivery", type: "INCOME", color: "#f59e0b", icon: "🛵", position: 4 },

  // ── EGRESOS — Materia Prima ───────────────────────────────
  { name: "Materia Prima", type: "EXPENSE", color: "#ef4444", icon: "🥬", position: 1 },
  { name: "Hod Food", type: "EXPENSE", color: "#f97316", icon: "📦", position: 2 },
  { name: "Palta", type: "EXPENSE", color: "#84cc16", icon: "🥑", position: 3 },
  { name: "Carivo", type: "EXPENSE", color: "#f97316", icon: "📦", position: 4 },
  { name: "Shen", type: "EXPENSE", color: "#f97316", icon: "📦", position: 5 },
  { name: "Bebestibles", type: "EXPENSE", color: "#06b6d4", icon: "🧃", position: 6 },
  { name: "Colación", type: "EXPENSE", color: "#ec4899", icon: "🍽️", position: 7 },
  { name: "Empaques y desechables", type: "EXPENSE", color: "#8b5cf6", icon: "🛍️", position: 8 },
  { name: "Postres", type: "EXPENSE", color: "#f43f5e", icon: "🍰", position: 9 },
  { name: "Limpieza e higiene", type: "EXPENSE", color: "#14b8a6", icon: "🧹", position: 10 },

  // ── EGRESOS — Operaciones ─────────────────────────────────
  { name: "Arriendo", type: "EXPENSE", color: "#64748b", icon: "🏠", position: 11 },
  { name: "Electricidad", type: "EXPENSE", color: "#eab308", icon: "⚡", position: 12 },
  { name: "Agua", type: "EXPENSE", color: "#3b82f6", icon: "💧", position: 13 },
  { name: "Gas", type: "EXPENSE", color: "#f97316", icon: "🔥", position: 14 },
  { name: "Toteat", type: "EXPENSE", color: "#6366f1", icon: "🖥️", position: 15 },
  { name: "Alarma / Internet", type: "EXPENSE", color: "#64748b", icon: "🔔", position: 16 },
  { name: "Reparaciones", type: "EXPENSE", color: "#dc2626", icon: "🔧", position: 17 },
  { name: "Fumigación", type: "EXPENSE", color: "#10b981", icon: "🪲", position: 18 },

  // ── EGRESOS — Administración ──────────────────────────────
  { name: "Contadora", type: "EXPENSE", color: "#7c3aed", icon: "📊", position: 19 },
  { name: "Patentes e impuestos", type: "EXPENSE", color: "#1d4ed8", icon: "📋", position: 20 },
  { name: "Insumos de oficina", type: "EXPENSE", color: "#64748b", icon: "📎", position: 21 },
  { name: "Comisiones bancarias", type: "EXPENSE", color: "#374151", icon: "🏛️", position: 22 },
  { name: "Devolución a clientes", type: "EXPENSE", color: "#ef4444", icon: "↩️", position: 23 },
  { name: "Fee delivery", type: "EXPENSE", color: "#f59e0b", icon: "🛵", position: 24 },
] as const;

async function main() {
  // 1. Habilitar financialEnabled
  await prisma.restaurant.update({
    where: { id: HORUS_ID },
    data: { financialEnabled: true },
  });
  console.log("✅ financialEnabled activado en Horus Vegan");

  // 2. Borrar categorías existentes (por si se corre dos veces)
  const existing = await prisma.financialCategory.count({ where: { restaurantId: HORUS_ID } });
  if (existing > 0) {
    console.log(`⚠️  Ya existen ${existing} categorías — saltando seed (borra manualmente si querés re-seedear)`);
    return;
  }

  // 3. Crear categorías
  for (const cat of CATEGORIES) {
    await prisma.financialCategory.create({
      data: {
        restaurantId: HORUS_ID,
        name: cat.name,
        type: cat.type as "INCOME" | "EXPENSE",
        color: cat.color,
        icon: cat.icon,
        position: cat.position,
        isActive: true,
      },
    });
  }

  console.log(`✅ ${CATEGORIES.length} categorías creadas para Horus Vegan`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
