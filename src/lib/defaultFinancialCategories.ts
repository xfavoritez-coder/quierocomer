type DefaultCategory = {
  name: string;
  type: "INCOME" | "EXPENSE";
  group: string | null;
  icon: string | null;
  color: string | null;
  position: number;
};

export const DEFAULT_FINANCIAL_CATEGORIES: DefaultCategory[] = [
  // ── EGRESOS ─────────────────────────────────────────────────────────────────
  // Proveedores
  { name: "Carnes y Pescados",       type: "EXPENSE", group: "Proveedores",    icon: "🥩", color: "#ef4444", position: 0 },
  { name: "Verduras y Frutas",       type: "EXPENSE", group: "Proveedores",    icon: "🥦", color: "#22c55e", position: 1 },
  { name: "Lácteos y Huevos",        type: "EXPENSE", group: "Proveedores",    icon: "🥛", color: "#f59e0b", position: 2 },
  { name: "Abarrotes y Secos",       type: "EXPENSE", group: "Proveedores",    icon: "🫙", color: "#a78bfa", position: 3 },
  { name: "Bebidas y Licores",       type: "EXPENSE", group: "Proveedores",    icon: "🍷", color: "#8b5cf6", position: 4 },
  // Operaciones
  { name: "Luz y Gas",               type: "EXPENSE", group: "Operaciones",    icon: "⚡", color: "#f59e0b", position: 5 },
  { name: "Agua",                    type: "EXPENSE", group: "Operaciones",    icon: "💧", color: "#3b82f6", position: 6 },
  { name: "Arriendo",                type: "EXPENSE", group: "Operaciones",    icon: "🏠", color: "#64748b", position: 7 },
  { name: "Reparaciones y Mantención", type: "EXPENSE", group: "Operaciones", icon: "🔧", color: "#94a3b8", position: 8 },
  { name: "Aseo y Limpieza",         type: "EXPENSE", group: "Operaciones",    icon: "🧹", color: "#06b6d4", position: 9 },
  { name: "Packaging y Desechables", type: "EXPENSE", group: "Operaciones",    icon: "📦", color: "#84cc16", position: 10 },
  // Personal
  { name: "Sueldos",                 type: "EXPENSE", group: "Personal",       icon: "👥", color: "#6366f1", position: 11 },
  { name: "Movilización",            type: "EXPENSE", group: "Personal",       icon: "🚌", color: "#0ea5e9", position: 12 },
  { name: "Colación",                type: "EXPENSE", group: "Personal",       icon: "🍱", color: "#f97316", position: 13 },
  // Administración
  { name: "Comisiones Transbank",    type: "EXPENSE", group: "Administración", icon: "💳", color: "#1d4ed8", position: 14 },
  { name: "Planes y Software",       type: "EXPENSE", group: "Administración", icon: "📱", color: "#7c3aed", position: 15 },
  { name: "Contabilidad",            type: "EXPENSE", group: "Administración", icon: "🧾", color: "#475569", position: 16 },
  { name: "Impuestos y Patentes",    type: "EXPENSE", group: "Administración", icon: "🏛️", color: "#374151", position: 17 },
  // Marketing
  { name: "Publicidad Digital",      type: "EXPENSE", group: "Marketing",      icon: "📣", color: "#f43f5e", position: 18 },
  { name: "Material Gráfico",        type: "EXPENSE", group: "Marketing",      icon: "🎨", color: "#ec4899", position: 19 },

  // ── INGRESOS ─────────────────────────────────────────────────────────────────
  { name: "Ventas Efectivo",         type: "INCOME",  group: "Ventas",         icon: "💵", color: "#22c55e", position: 0 },
  { name: "Ventas Transbank",        type: "INCOME",  group: "Ventas",         icon: "💳", color: "#16a34a", position: 1 },
  { name: "Ventas App / Delivery",   type: "INCOME",  group: "Ventas",         icon: "📱", color: "#15803d", position: 2 },
  { name: "Otros Ingresos",          type: "INCOME",  group: null,             icon: "💰", color: "#4ade80", position: 3 },
];

export async function seedDefaultCategories(prisma: any, restaurantId: string) {
  await prisma.financialCategory.createMany({
    data: DEFAULT_FINANCIAL_CATEGORIES.map(c => ({ ...c, restaurantId })),
    skipDuplicates: true,
  });
}
