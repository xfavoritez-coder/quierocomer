import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { FLOW_PLANS, PLAN_LABELS, grossOf, type PlanKey } from "@/lib/billing/plans-config";
import { sendAdminEmail, planActivatedEmailHtml } from "@/lib/email/sendAdminEmail";

/**
 * POST /api/admin/manual-payment
 * Body: { restaurantId, plan, method: "transfer"|"cash"|"other", amount?: number, note?: string }
 *
 * Registra un pago manual (transferencia, efectivo, etc.) sin pasar por MercadoPago.
 * Activa el plan, avanza el período 30 días, y envía email de confirmación al dueño.
 */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) {
    return NextResponse.json({ error: "Solo super-admin" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.restaurantId || !body?.plan || !body?.method) {
    return NextResponse.json({ error: "restaurantId, plan y method requeridos" }, { status: 400 });
  }

  const { restaurantId, plan, method, amount, note } = body as {
    restaurantId: string;
    plan: string;
    method: "transfer" | "cash" | "other";
    amount?: number;
    note?: string;
  };

  const planKey = plan as Exclude<PlanKey, "FREE">;
  const planConfig = FLOW_PLANS[planKey];
  if (!planConfig) {
    return NextResponse.json({ error: `Plan "${plan}" no válido` }, { status: 400 });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, slug: true, customPlanPriceNet: true, owner: { select: { email: true, name: true } } },
  });
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const effectiveNet = restaurant.customPlanPriceNet ?? planConfig.amountNet;
  const amountGross = amount ?? grossOf(effectiveNet);

  // Actualizar restaurante
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      plan: planKey,
      subscriptionStatus: "ACTIVE",
      currentPeriodEnd: periodEnd,
      lastPaymentAt: now,
      billingExempt: false,
    },
  });

  // Registrar en activity log
  const methodLabels: Record<string, string> = {
    transfer: "Transferencia bancaria",
    cash: "Efectivo",
    other: "Otro",
  };

  await prisma.panelActivity.create({
    data: {
      restaurantId,
      action: "manual_payment",
      details: {
        plan: planKey,
        method,
        methodLabel: methodLabels[method] || method,
        amountGross,
        note: note || null,
        periodEnd: periodEnd.toISOString(),
      },
    },
  }).catch(() => {});

  // Enviar email de confirmación al dueño
  const ownerEmail = restaurant.owner?.email;
  if (ownerEmail) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
    const ownerName = restaurant.owner?.name || ownerEmail.split("@")[0] || "Hola";
    const planLabel = PLAN_LABELS[planKey as keyof typeof PLAN_LABELS] || planKey;
    const amountStr = `$${amountGross.toLocaleString("es-CL")} CLP`;
    const nextDate = periodEnd.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
    const nextAmount = `$${grossOf(effectiveNet).toLocaleString("es-CL")} CLP`;

    sendAdminEmail({
      to: ownerEmail,
      subject: `${restaurant.name} · Plan ${planLabel} activado`,
      html: planActivatedEmailHtml(ownerName, restaurant.name, planLabel, amountStr, nextDate, nextAmount, `${baseUrl}/panel`, `${baseUrl}/qr/${restaurant.slug}`),
      purpose: "manual_payment_confirmation",
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    plan: planKey,
    currentPeriodEnd: periodEnd.toISOString(),
    amountGross,
    method,
  });
}
