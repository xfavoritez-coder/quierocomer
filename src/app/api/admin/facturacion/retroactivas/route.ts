import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { emitirBoletaSuscripcion } from "@/lib/simplefactura";

/**
 * POST /api/admin/facturacion/retroactivas
 * Emite boletas para todos los clientes activos que ya pagaron.
 * Body: { dryRun?: boolean, periodo?: string }
 */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const { dryRun = true, periodo = "junio 2026" } = await req.json();

  const PLAN_PRICES: Record<string, number> = {
    GOLD: 29900,
    PREMIUM: 44900,
    SILVER: 14900,
  };

  // Find all active paying restaurants
  const restaurants = await prisma.restaurant.findMany({
    where: {
      plan: { in: ["GOLD", "PREMIUM", "SILVER"] },
      subscriptionStatus: "ACTIVE",
      isActive: true,
      isDemo: false,
      billingExempt: { not: true },
    },
    include: { owner: { select: { name: true, email: true } } },
  });

  const results: any[] = [];

  for (const r of restaurants) {
    const monto = PLAN_PRICES[r.plan || ""] || 0;
    if (!monto) continue;

    const ownerName = r.owner?.name || r.name;
    const ownerEmail = r.owner?.email || "";

    if (dryRun) {
      results.push({
        restaurant: r.name,
        plan: r.plan,
        monto,
        email: ownerEmail,
        status: "DRY_RUN",
      });
      continue;
    }

    try {
      const result = await emitirBoletaSuscripcion({
        planNombre: r.plan === "PREMIUM" ? "Premium" : r.plan === "GOLD" ? "Gold" : "Silver",
        montoTotal: monto,
        nombreCliente: ownerName,
        emailCliente: ownerEmail,
        periodo,
      });

      results.push({
        restaurant: r.name,
        plan: r.plan,
        monto,
        email: ownerEmail,
        folio: result.folio,
        status: "OK",
      });

      // Small delay between emissions
      await new Promise(resolve => setTimeout(resolve, 600));
    } catch (e: any) {
      results.push({
        restaurant: r.name,
        plan: r.plan,
        monto,
        email: ownerEmail,
        status: "ERROR",
        error: e.message?.slice(0, 100),
      });
    }
  }

  return NextResponse.json({
    dryRun,
    total: results.length,
    ok: results.filter(r => r.status === "OK").length,
    errors: results.filter(r => r.status === "ERROR").length,
    results,
  });
}
