import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { isSuperAdmin } from "@/lib/adminAuth";
import { getClientSegmentation, type ClientRow } from "@/lib/ecommerce/client-segmentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  if (isSuperAdmin(req)) return true;
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) return teamMemberCanAccess(panelId.slice(3), restaurantId);
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

/** GET /api/panel/ecommerce/recovery?restaurantId=X
 *  Dashboard de Recuperación Inteligente: KPIs, actividad reciente, razones de abandono. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  // Resolver sucursales hermanas
  const thisR = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  let allIds = [restaurantId];
  if (thisR?.ownerId) {
    const siblings = await prisma.restaurant.findMany({ where: { ownerId: thisR.ownerId }, select: { id: true } });
    if (siblings.length > 1) allIds = siblings.map(s => s.id);
  }

  // Clientes segmentados (todos de la marca, sin filtro de branch — para stats globales)
  const clients = await getClientSegmentation(restaurantId);

  const atRisk = clients.filter(c => c.status === "at_risk");
  const churned = clients.filter(c => c.status === "churned");
  const withEmail = clients.filter(c => !!c.email);
  const atRiskWithEmail = atRisk.filter(c => !!c.email);
  const churnedWithEmail = churned.filter(c => !!c.email);

  // Enrollments (de toda la marca)
  const enrollments = await prisma.recoveryEnrollment.findMany({
    where: { restaurantId: { in: allIds } },
    select: { automation: true, status: true, sentAt: true, openedAt: true, clickedAt: true, convertedAt: true, convertedOrderId: true, couponCode: true, surveyReason: true, surveyDetail: true, surveyComment: true, surveyAnsweredAt: true, createdAt: true, customerName: true, customerEmail: true, customerPhone: true },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });

  // KPIs
  const sent = enrollments.filter(e => e.sentAt);
  const converted = enrollments.filter(e => e.status === "converted");
  const opened = enrollments.filter(e => e.openedAt || e.clickedAt || e.surveyAnsweredAt || e.status === "opened" || e.status === "clicked" || e.status === "converted");

  // Ingresos recuperados
  let recoveredRevenue = 0;
  if (converted.length > 0) {
    const orderIds = converted.map(e => e.convertedOrderId).filter(Boolean) as string[];
    if (orderIds.length > 0) {
      const orders = await prisma.posOrder.findMany({
        where: { id: { in: orderIds } },
        select: { totalAmount: true, deliveryFee: true, tipAmount: true },
      });
      recoveredRevenue = orders.reduce((s, o) => s + Math.max(0, (o.totalAmount || 0) - (o.deliveryFee || 0) - (o.tipAmount || 0)), 0);
    }
  }

  // Razones de abandono
  const reasons = enrollments
    .filter(e => e.surveyReason)
    .reduce((acc, e) => { acc[e.surveyReason!] = (acc[e.surveyReason!] || 0) + 1; return acc; }, {} as Record<string, number>);

  // Por automatización
  const byAutomation: Record<string, { sent: number; opened: number; converted: number }> = {};
  for (const e of enrollments) {
    if (!byAutomation[e.automation]) byAutomation[e.automation] = { sent: 0, opened: 0, converted: 0 };
    if (e.sentAt) byAutomation[e.automation].sent++;
    if (e.status === "opened" || e.status === "clicked" || e.status === "converted") byAutomation[e.automation].opened++;
    if (e.status === "converted") byAutomation[e.automation].converted++;
  }

  // Respuestas de encuesta con comentarios (deduplicar por email, priorizar con respuesta)
  // Mapa de totalSpent por email desde los clientes segmentados
  const spentByEmail = new Map<string, number>();
  for (const c of clients) { if (c.email) spentByEmail.set(c.email.toLowerCase(), c.totalSpent); }

  const surveyResponseMap = new Map<string, { customerName: string | null; customerEmail: string; customerPhone: string | null; reason: string | null; detail: string | null; comment: string | null; answeredAt: string; totalSpent: number }>();
  for (const e of enrollments) {
    if (!e.surveyReason) continue;
    const key = e.customerEmail.toLowerCase();
    if (!surveyResponseMap.has(key)) {
      surveyResponseMap.set(key, {
        customerName: e.customerName, customerEmail: e.customerEmail, customerPhone: e.customerPhone || null,
        reason: e.surveyReason, detail: e.surveyDetail || null,
        comment: e.surveyComment || null,
        answeredAt: e.surveyAnsweredAt?.toISOString() || e.createdAt.toISOString(),
        totalSpent: spentByEmail.get(key) || 0,
      });
    }
  }
  const surveyResponses = [...surveyResponseMap.values()];

  // Actividad reciente (últimos 30)
  const recent = enrollments.slice(0, 30).map(e => ({
    automation: e.automation,
    status: e.status,
    customerName: e.customerName,
    customerEmail: e.customerEmail,
    couponCode: e.couponCode || null,
    surveyReason: e.surveyReason || null,
    sentAt: e.sentAt?.toISOString() || null,
    openedAt: e.openedAt?.toISOString() || null,
    clickedAt: e.clickedAt?.toISOString() || null,
    convertedAt: e.convertedAt?.toISOString() || null,
    createdAt: e.createdAt.toISOString(),
  }));

  return NextResponse.json({
    kpis: {
      totalClients: clients.length,
      withEmail: withEmail.length,
      atRisk: atRisk.length,
      churned: churned.length,
      contacted: sent.length,
      opened: opened.length,
      responded: surveyResponses.length,
      recovered: converted.length,
      recoveryRate: sent.length > 0 ? Math.round((converted.length / sent.length) * 100) : 0,
      recoveredRevenue,
      // Cupones
      couponsSent: enrollments.filter(e => e.automation === "recovery_incentive" && e.sentAt).length,
      couponsOpened: enrollments.filter(e => e.automation === "recovery_incentive" && (e.openedAt || e.clickedAt)).length,
      couponsUsed: enrollments.filter(e => e.automation === "recovery_incentive" && e.status === "converted").length,
    },
    reasons,
    surveyResponses,
    byAutomation,
    recent,
    // Cola de próximos envíos: clientes que recibirán email pronto
    // (en riesgo o inactivos con email, que NO han sido contactados aún)
    queue: (() => {
      const contactedEmails = new Set(enrollments.filter(e => e.sentAt).map(e => e.customerEmail.toLowerCase()));
      return [...atRisk, ...churned]
        .filter(c => c.email && !contactedEmails.has(c.email.toLowerCase()))
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 15)
        .map(c => ({
          email: c.email, name: c.name, orders: c.orders, totalSpent: c.totalSpent,
          daysSinceLastOrder: c.daysSinceLastOrder, avgFrequencyDays: c.avgFrequencyDays,
          status: c.status, riskScore: c.riskScore,
        }));
    })(),
  });
}
