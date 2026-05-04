import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { FLOW_PLANS } from "@/lib/billing/plans-config";

/**
 * POST /api/billing/start
 * Body: { restaurantId, plan: "GOLD" | "PREMIUM" }
 *
 * Si el restaurant no tiene flowCustomerId aun, crea el customer en Flow.
 * Luego inicia el registro de tarjeta y devuelve la URL para redirigir
 * al comerciante a Webpay para inscribir su tarjeta.
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

  const planConfig = FLOW_PLANS[plan];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;

  try {
    let flowCustomerId = restaurant.flowCustomerId;
    if (!flowCustomerId) {
      try {
        const customer = await flowPost<{ customerId: string }>("/customer/create", {
          name: restaurant.name,
          email: owner.email,
          externalId: restaurant.id,
        });
        flowCustomerId = customer.customerId;
      } catch (createErr: any) {
        // Si Flow dice que ya existe, lo buscamos via /customer/list filtrando por email
        if (!createErr?.message?.includes("There is a customer with this externalId")) throw createErr;
        const list = await flowPost<{ data: Array<{ customerId: string; externalId: string }> }>(
          "/customer/list",
          { filter: owner.email, limit: 100 }
        );
        const found = list.data?.find((c) => c.externalId === restaurant.id);
        if (!found) throw createErr;
        flowCustomerId = found.customerId;
      }
      // Guardamos inmediatamente para no perderlo si el siguiente paso falla
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: { flowCustomerId },
      });
    }

    const register = await flowPost<{ url: string; token: string }>("/customer/register", {
      customerId: flowCustomerId,
      url_return: `${baseUrl}/api/billing/return`,
    });

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        flowRegisterToken: register.token,
        pendingFlowPlanId: planConfig.planId,
      },
    });

    return NextResponse.json({ url: `${register.url}?token=${register.token}` });
  } catch (err: any) {
    const msg = err?.message || "Error desconocido";
    let userMessage = msg;
    if (msg.includes("automatic charge contract")) {
      userMessage = "Falta activar el servicio Cargo Automatico en Flow. Reintenta en unos minutos despues de activarlo.";
    } else if (err?.code === 7001) {
      userMessage = "Servicio de Flow no disponible. Verifica la configuracion en el dashboard de Flow.";
    }
    console.error("[billing/start]", msg);
    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}
