import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin, authErrorResponse } from "@/lib/adminAuth";
import { emitirBoletaSuscripcion, emitirFacturaSuscripcion, descargarPDF } from "@/lib/simplefactura";

/**
 * POST /api/admin/facturacion
 * Emitir boleta o factura para un restaurante (manual o retroactiva).
 * Body: { restaurantId, tipo: "boleta"|"factura", periodo?: string }
 */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  try {
    const { restaurantId, tipo = "boleta", periodo } = await req.json();
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { owner: { select: { name: true, email: true } } },
    });
    if (!restaurant) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

    const plan = restaurant.plan || "FREE";
    if (plan === "FREE") return NextResponse.json({ error: "Restaurante en plan FREE, no hay cobro" }, { status: 400 });

    // Determine price from plan
    const PLAN_PRICES: Record<string, number> = {
      GOLD: 29900,
      PREMIUM: 44900,
      SILVER: 14900,
    };
    const montoTotal = PLAN_PRICES[plan] || 0;
    if (!montoTotal) return NextResponse.json({ error: `Plan ${plan} sin precio definido` }, { status: 400 });

    const ownerName = restaurant.owner?.name || restaurant.name;
    const ownerEmail = restaurant.owner?.email || "";

    let result;

    if (tipo === "factura") {
      // Factura requires billing data
      const billing = restaurant as any;
      if (!billing.billingRut || !billing.billingCompanyName) {
        return NextResponse.json({ error: "El restaurante no tiene datos de facturación completos (RUT, razón social, giro, dirección)" }, { status: 400 });
      }

      result = await emitirFacturaSuscripcion({
        planNombre: plan === "PREMIUM" ? "Premium" : plan === "GOLD" ? "Gold" : "Silver",
        montoTotal,
        nombreCliente: ownerName,
        emailCliente: ownerEmail,
        periodo,
        rutEmpresa: billing.billingRut,
        razonSocial: billing.billingCompanyName,
        giro: billing.billingGiro || "Restaurantes y similares",
        direccion: billing.billingAddress || restaurant.address || "Sin dirección",
        comuna: billing.billingCity || "Santiago",
      });
    } else {
      // Boleta (default)
      result = await emitirBoletaSuscripcion({
        planNombre: plan === "PREMIUM" ? "Premium" : plan === "GOLD" ? "Gold" : "Silver",
        montoTotal,
        nombreCliente: ownerName,
        emailCliente: ownerEmail,
        periodo,
      });
    }

    // Save to DB
    if (result.folio) {
      await prisma.invoice.create({
        data: {
          restaurantId,
          folio: result.folio,
          tipoDTE: result.tipoDTE,
          total: montoTotal,
          periodo: periodo || null,
          status: "EMITIDA",
          emittedAt: new Date(),
          metadata: result.raw || {},
        },
      }).catch((e: any) => {
        // Invoice model might not exist yet — log but don't fail
        console.warn("[facturacion] Could not save invoice to DB:", e.message);
      });
    }

    return NextResponse.json({
      ok: true,
      folio: result.folio,
      tipoDTE: result.tipoDTE,
      total: montoTotal,
      restaurant: restaurant.name,
      email: ownerEmail,
    });
  } catch (e: any) {
    console.error("[facturacion]", e);
    return NextResponse.json({ error: e.message || "Error al emitir documento" }, { status: 500 });
  }
}

/**
 * GET /api/admin/facturacion?restaurantId=xxx
 * Lista documentos emitidos para un restaurante.
 */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");

  try {
    const invoices = await prisma.invoice.findMany({
      where: restaurantId ? { restaurantId } : {},
      orderBy: { emittedAt: "desc" },
      take: 50,
    });
    return NextResponse.json(invoices);
  } catch {
    // Model might not exist yet
    return NextResponse.json([]);
  }
}
