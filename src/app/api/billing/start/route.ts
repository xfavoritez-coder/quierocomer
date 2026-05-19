import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMPCustomer, createMPPlan, createMPSubscription } from "@/lib/billing/mercadopago";
import { FLOW_PLANS } from "@/lib/billing/plans-config";

/**
 * POST /api/billing/start
 * Body: { restaurantId, plan: "GOLD" | "PREMIUM" }
 *
 * Crea un plan y suscripcion en MercadoPago con trial de 14 dias.
 * Devuelve la URL (init_point) para redirigir al comerciante a completar
 * la inscripcion de su tarjeta en MercadoPago.
 */
export async function POST(req: NextRequest) {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { restaurantId?: string; plan?: keyof typeof FLOW_PLANS };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body invalido" }, { status: 400 }); }

  const { restaurantId, plan } = body;
  if (!restaurantId || !plan || !FLOW_PLANS[plan]) {
    return NextResponse.json({ error: "Faltan parametros" }, { status: 400 });
  }

  const owner = await prisma.restaurantOwner.findUnique({
    where: { id: panelId },
    include: { restaurants: { where: { id: restaurantId }, take: 1 } },
  });
  if (!owner || owner.status !== "ACTIVE") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const restaurant = owner.restaurants[0];
  if (!restaurant) return NextResponse.json({ error: "Restaurant no encontrado" }, { status: 404 });

  // Nota: ya NO bloqueamos por datos de facturacion incompletos. Los pedimos
  // despues de que el cliente pago el primer mes (asi no espantamos el alta).
  // El banner en /panel y el email post-pago se encargan de empujar a que
  // los completen para emitir la factura electronica.

  const planConfig = FLOW_PLANS[plan];

  try {
    // 1. Asegurar que existe un customer en MercadoPago
    let mpCustomerId = restaurant.mpCustomerId;
    if (!mpCustomerId) {
      const customer = await createMPCustomer(owner.email, restaurant.name);
      mpCustomerId = customer.id;
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: { mpCustomerId },
      });
    }

    // 2. Crear el plan (PreApprovalPlan) en MercadoPago.
    //    Cada suscripcion individual se crea con su propio plan para
    //    mantener trazabilidad. El trial viene configurado en createMPPlan.
    const mpPlan = await createMPPlan(plan);

    // 3. Crear la suscripcion (PreApproval) asociada al plan
    const subscription = await createMPSubscription({
      planId: mpPlan.id,
      payerEmail: owner.email,
      externalReference: restaurant.id,
    });

    // 4. Guardar estado pendiente en DB
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        pendingMpPlanId: planConfig.planId,
        mpSubscriptionId: subscription.id,
      },
    });

    return NextResponse.json({ url: subscription.initPoint });
  } catch (err: any) {
    const msg = err?.message || "Error desconocido";
    console.error("[billing/start]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
