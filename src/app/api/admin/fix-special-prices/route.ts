import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

/**
 * POST /api/admin/fix-special-prices
 * Setea customPlanPriceNet para locales con precios acordados fuera del estándar.
 * Solo super-admin. Idempotente: se puede llamar múltiples veces.
 */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo super-admin" }, { status: 403 });

  const updates = [
    // Neto 14.900 → total $17.731 con IVA
    { nameContains: "Menú de la Esquina", customPlanPriceNet: 14900 },
    // Neto 42.017 → total $50.000 con IVA incluido
    { nameContains: "Krua Thai", customPlanPriceNet: 42017 },
    // Neto 50.000 → total $59.500 (50.000 + IVA)
    { nameContains: "Alleria", customPlanPriceNet: 50000 },
  ];

  const results: { name: string; customPlanPriceNet: number; gross: number }[] = [];

  for (const u of updates) {
    const restaurants = await prisma.restaurant.findMany({
      where: { name: { contains: u.nameContains, mode: "insensitive" }, isDemo: false },
      select: { id: true, name: true },
    });
    for (const r of restaurants) {
      await prisma.restaurant.update({
        where: { id: r.id },
        data: { customPlanPriceNet: u.customPlanPriceNet },
      });
      results.push({
        name: r.name,
        customPlanPriceNet: u.customPlanPriceNet,
        gross: Math.round(u.customPlanPriceNet * 1.19),
      });
    }
  }

  return NextResponse.json({ ok: true, updated: results });
}
