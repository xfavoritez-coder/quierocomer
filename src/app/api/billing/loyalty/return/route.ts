import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flowPost } from "@/lib/billing/flow";
import { grossOf } from "@/lib/billing/plans-config";
import { LOYALTY_PLAN_NET } from "@/lib/billing/plans-central";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";

function redirect303(url: string) {
  return NextResponse.redirect(url, 303);
}

async function handleReturn(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";

  let token = req.nextUrl.searchParams.get("token");
  if (!token && req.method === "POST") {
    try { const form = await req.formData(); token = (form.get("token") as string) || null; } catch {}
  }
  if (!token) return redirect303(`${baseUrl}/panel/mi-restaurante?billing=error&reason=no_token`);

  let restaurant = await prisma.restaurant.findFirst({
    where: { loyaltyFlowRegisterToken: { startsWith: token } },
    include: { owner: { select: { email: true, name: true } } },
  });
  if (!restaurant) {
    restaurant = await prisma.restaurant.findFirst({
      where: { loyaltyFlowRegisterToken: token },
      include: { owner: { select: { email: true, name: true } } },
    });
  }
  if (!restaurant) return redirect303(`${baseUrl}/panel/mi-restaurante?billing=error&reason=not_found`);

  // Si ya fue activado por webhook
  if (restaurant.loyaltyStatus === "ACTIVE" && restaurant.loyaltyLastPaymentAt && !restaurant.loyaltyFlowRegisterToken) {
    return redirect303(`${baseUrl}/panel/loyalty?loyalty=activated`);
  }

  const savedToken = restaurant.loyaltyFlowRegisterToken || "";
  const [, flowOrderStr] = savedToken.split("|");
  const flowOrder = flowOrderStr ? Number(flowOrderStr) : null;

  let paymentStatus: number | null = null;
  try {
    const result = await flowPost<any>("/payment/getStatus", { token });
    paymentStatus = result.status;
  } catch {}
  if (paymentStatus === null && flowOrder) {
    try {
      const result = await flowPost<any>("/payment/getStatusByFlowOrder", { flowOrder });
      paymentStatus = result.status;
    } catch {}
  }

  if (paymentStatus === 2) {
    const existingEnd = restaurant.loyaltyPeriodEnd ? new Date(restaurant.loyaltyPeriodEnd) : null;
    const isEarlyRenewal = restaurant.loyaltyStatus === "ACTIVE" && !!existingEnd && existingEnd > new Date();
    const baseDate = isEarlyRenewal ? existingEnd! : new Date();
    const periodEnd = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        loyaltyStatus: "ACTIVE",
        loyaltyPeriodEnd: periodEnd,
        loyaltyLastPaymentAt: new Date(),
        loyaltyFlowRegisterToken: null,
        loyaltyTrialEndsAt: null,
      },
    });

    const ownerEmail = restaurant.owner?.email;
    if (ownerEmail) {
      const firstName = (restaurant.owner?.name || "").split(" ")[0] || "Hola";
      const amountPaid = `$${grossOf(LOYALTY_PLAN_NET).toLocaleString("es-CL")} CLP`;
      const nextDate = periodEnd.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
      const isRenewal = isEarlyRenewal;
      sendAdminEmail({
        to: ownerEmail,
        subject: `${restaurant.name} · Loyalty ${isRenewal ? "renovado" : "activado"}`,
        html: `<p>Hola ${firstName}, tu módulo Loyalty está ${isRenewal ? "renovado" : "activo"} hasta el ${nextDate}. Monto: ${amountPaid}.</p><p><a href="${baseUrl}/panel/loyalty">Ir al panel →</a></p>`,
        purpose: isRenewal ? "loyalty_renewed" : "loyalty_activated",
      }).catch(() => {});
    }

    return redirect303(`${baseUrl}/panel/loyalty?loyalty=activated`);
  }

  if (paymentStatus === 3 || paymentStatus === 4) {
    await prisma.restaurant.update({ where: { id: restaurant.id }, data: { loyaltyFlowRegisterToken: null } });
    return redirect303(`${baseUrl}/panel/mi-restaurante?billing=error&reason=rejected`);
  }

  return redirect303(`${baseUrl}/panel/mi-restaurante?billing=pending`);
}

export async function GET(req: NextRequest) { return handleReturn(req); }
export async function POST(req: NextRequest) { return handleReturn(req); }
