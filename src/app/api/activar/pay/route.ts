import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { FLOW_PLANS } from "@/lib/billing/plans-config";

/**
 * POST /api/activar/pay
 * Body: { restaurantId, plan: "GOLD" | "PREMIUM" }
 *
 * Inicia el registro de tarjeta en Flow para un restaurant demo.
 * No requiere autenticación — solo funciona para restaurants con isDemo: true.
 */
export async function POST(req: NextRequest) {
  let body: { restaurantId?: string; plan?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { restaurantId, plan } = body;
  if (!restaurantId || !plan || !(plan === "GOLD" || plan === "PREMIUM")) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { owner: { select: { email: true } } },
  });

  if (!restaurant || !restaurant.isDemo) {
    return NextResponse.json({ error: "Restaurant no encontrado o ya activado" }, { status: 404 });
  }

  const ownerEmail = restaurant.owner?.email;
  if (!ownerEmail) {
    return NextResponse.json({ error: "No hay email del dueño. Contacta soporte." }, { status: 400 });
  }

  const planConfig = FLOW_PLANS[plan as "GOLD" | "PREMIUM"];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://${req.headers.get("host")}`;

  try {
    // Crear o encontrar customer en Flow
    let flowCustomerId = restaurant.flowCustomerId;
    if (!flowCustomerId) {
      try {
        const customer = await flowPost<{ customerId: string }>("/customer/create", {
          name: restaurant.name,
          email: ownerEmail,
          externalId: restaurant.id,
        });
        flowCustomerId = customer.customerId;
      } catch (createErr: any) {
        if (!createErr?.message?.includes("There is a customer with this externalId")) throw createErr;
        const list = await flowPost<{ data: Array<{ customerId: string; externalId: string }> }>(
          "/customer/list",
          { filter: ownerEmail, limit: 100 },
        );
        const found = list.data?.find((c) => c.externalId === restaurant.id);
        if (!found) throw createErr;
        flowCustomerId = found.customerId;
      }
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: { flowCustomerId },
      });
    }

    // Registrar tarjeta
    const register = await flowPost<{ url: string; token: string }>("/customer/register", {
      customerId: flowCustomerId,
      url_return: `${baseUrl}/api/activar/pay/return`,
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
      userMessage = "Servicio de Cargo Automático no habilitado en Flow.";
    } else if (err?.code === 7001) {
      userMessage = "Servicio de Flow no disponible.";
    }
    console.error("[activar/pay]", msg);
    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}
