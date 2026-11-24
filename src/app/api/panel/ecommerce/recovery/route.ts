import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { isSuperAdmin } from "@/lib/adminAuth";
import { getClientSegmentation, type ClientRow } from "@/lib/ecommerce/client-segmentation";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";
import { pickAutomation, surveyMinDays, indexEnrollments } from "@/lib/ecommerce/recovery-eligibility";
import { readImportedClients, buildImportedChurnedClients } from "@/lib/ecommerce/recoveryImport";

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
  const thisR = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true, ecommerceStoreConfig: true } });
  let allIds = [restaurantId];
  if (thisR?.ownerId) {
    const siblings = await prisma.restaurant.findMany({ where: { ownerId: thisR.ownerId }, select: { id: true } });
    if (siblings.length > 1) allIds = siblings.map(s => s.id);
  }

  // Clientes segmentados (todos de la marca, sin filtro de branch — para stats globales)
  const realClients = await getClientSegmentation(restaurantId);
  // Clientes importados manualmente que NO tienen pedidos: se tratan como perdidos.
  const existingEmails = new Set(realClients.filter(c => c.email).map(c => c.email.toLowerCase()));
  const importedClients = buildImportedChurnedClients(readImportedClients(thisR?.ecommerceStoreConfig), existingEmails, restaurantId);
  const clients = [...realClients, ...importedClients];

  const atRisk = clients.filter(c => c.status === "at_risk");
  const churned = clients.filter(c => c.status === "churned");
  const withEmail = clients.filter(c => !!c.email);
  const atRiskWithEmail = atRisk.filter(c => !!c.email);
  const churnedWithEmail = churned.filter(c => !!c.email);

  // Enrollments (de toda la marca)
  const enrollments = await prisma.recoveryEnrollment.findMany({
    where: { restaurantId: { in: allIds } },
    select: { restaurantId: true, automation: true, status: true, sentAt: true, openedAt: true, clickedAt: true, convertedAt: true, convertedOrderId: true, couponCode: true, surveyReason: true, surveyDetail: true, surveyComment: true, surveyAnsweredAt: true, createdAt: true, customerName: true, customerEmail: true, customerPhone: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  // Usos reales de los cupones de recuperación (EcommerceCouponUse se registra al
  // confirmar el pedido/pago con el cupón). Así "Cupones usados" y "Recuperados" se
  // reflejan al instante, sin esperar la atribución del cron diario.
  const couponCodes = enrollments.filter(e => e.automation === "recovery_incentive" && e.couponCode).map(e => e.couponCode!);
  const couponUses = couponCodes.length
    ? await prisma.ecommerceCouponUse.findMany({ where: { couponCode: { in: couponCodes } }, select: { couponCode: true, orderId: true } })
    : [];
  const useByCode = new Map(couponUses.map(u => [u.couponCode, u]));
  const couponUsed = (e: { couponCode: string | null }) => !!e.couponCode && useByCode.has(e.couponCode);

  // KPIs — deduplicar por email para no contar la misma persona 2 veces
  // (un cliente puede tener enrollments en múltiples sucursales)
  const sentEmails = new Set(enrollments.filter(e => e.sentAt).map(e => e.customerEmail.toLowerCase()));
  const sent = { length: sentEmails.size };
  const convertedEmails = new Set(enrollments.filter(e => e.status === "converted" || couponUsed(e)).map(e => e.customerEmail.toLowerCase()));
  const converted = { length: convertedEmails.size };
  const openedEmails = new Set(enrollments.filter(e => e.openedAt || e.clickedAt || e.surveyAnsweredAt || e.status === "opened" || e.status === "clicked" || e.status === "converted").map(e => e.customerEmail.toLowerCase()));
  const opened = { length: openedEmails.size };

  // Ingresos recuperados — deduplicar por orderId para no contar el mismo pedido 2 veces
  let recoveredRevenue = 0;
  if (converted.length > 0) {
    const convertedEnrollments = enrollments.filter(e => e.status === "converted" || couponUsed(e));
    const onlineIdSet = new Set<string>();
    const posIdSet = new Set<string>();
    for (const e of convertedEnrollments) {
      if (couponUsed(e)) { const oid = useByCode.get(e.couponCode!)?.orderId; if (oid) onlineIdSet.add(oid); }
      else if (e.convertedOrderId) posIdSet.add(e.convertedOrderId);
    }
    const onlineIds = [...onlineIdSet];
    const posIds = [...posIdSet];
    const [onlineOrders, posOrders] = await Promise.all([
      onlineIds.length ? prisma.onlineOrder.findMany({ where: { id: { in: onlineIds } }, select: { total: true, deliveryFee: true } }) : [],
      posIds.length ? prisma.posOrder.findMany({ where: { id: { in: posIds } }, select: { totalAmount: true, deliveryFee: true, tipAmount: true } }) : [],
    ]);
    recoveredRevenue =
      onlineOrders.reduce((s, o) => s + Math.max(0, (o.total || 0) - (o.deliveryFee || 0)), 0) +
      posOrders.reduce((s, o) => s + Math.max(0, (o.totalAmount || 0) - (o.deliveryFee || 0) - (o.tipAmount || 0)), 0);
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

  const clientByEmail = new Map<string, ClientRow>();
  for (const c of clients) if (c.email) clientByEmail.set(c.email.toLowerCase(), c);

  // ── Cola: replica las reglas del cron para ESTE restaurante ──
  const rc = parseStoreConfig(thisR?.ecommerceStoreConfig).recovery;
  const since180 = Date.now() - 180 * 86400000;
  // Usar TODOS los enrollments de la marca (no solo esta sucursal), igual que el cron
  const idx = indexEnrollments(enrollments.filter(e => e.createdAt.getTime() >= since180));
  const candidateEmails = [...atRiskWithEmail, ...churnedWithEmail].map(c => c.email!.toLowerCase());
  const unsubscribed = new Set<string>();
  if (candidateEmails.length) {
    const unsubs = await prisma.qRUser.findMany({ where: { email: { in: candidateEmails, mode: "insensitive" }, unsubscribedAt: { not: null } }, select: { email: true } });
    for (const u of unsubs) if (u.email) unsubscribed.add(u.email.toLowerCase());
  }
  // Igual que el cron: cada cliente se contacta desde la sucursal de su último pedido
  // (si esa sucursal tiene recuperación activa).
  const brandRests = await prisma.restaurant.findMany({ where: { id: { in: allIds } }, select: { id: true, ecommerceStoreConfig: true } });
  // Mismo criterio que el cron: recovery.enabled (no orderingEnabled, flag legacy).
  const recoveryOnIds = new Set(brandRests.filter(r => parseStoreConfig(r.ecommerceStoreConfig).recovery.enabled).map(r => r.id));
  const fullQueue = rc.enabled ? churnedWithEmail.flatMap(c => {
    if (c.lastRestaurantId && c.lastRestaurantId !== restaurantId && recoveryOnIds.has(c.lastRestaurantId)) return [];
    const em = c.email!.toLowerCase();
    if (unsubscribed.has(em)) return [];
    const ls = idx.lastSent.get(em);
    if (ls && Date.now() - ls < rc.cooldownDays * 86400000) return [];
    if ((idx.sentLast30.get(em) ?? 0) >= rc.maxEmailsPerMonth) return [];
    const automation = pickAutomation(c, rc, em, idx);
    return automation ? [{ c, automation }] : [];
  }) : [];
  // También incluir perdidos que AÚN no llegan al umbral pero lo harán
  type PendingItem = { c: ClientRow; nextEmail: string; daysLeft: number; minDays: number };
  const COUPON_DAYS = 3;
  const futureQueue: PendingItem[] = rc.enabled ? churnedWithEmail.flatMap((c): PendingItem[] => {
    const em = c.email!.toLowerCase();
    if (unsubscribed.has(em)) return [];
    if (idx.hasEnrollment.has(`${em}::abandonment_survey`) && idx.hasEnrollment.has(`${em}::recovery_incentive`)) return [];
    if (fullQueue.some(q => q.c.email?.toLowerCase() === em)) return [];
    const hasSurvey = idx.hasEnrollment.has(`${em}::abandonment_survey`);
    if (hasSurvey) {
      // Encuesta ya enviada → próximo es cupón. Calcular días desde encuesta.
      const surveyAt = idx.surveySentAt.get(em);
      const daysSinceSurvey = surveyAt ? Math.round((Date.now() - surveyAt) / 86400000) : 0;
      const daysLeft = Math.max(0, COUPON_DAYS - daysSinceSurvey);
      return [{ c, nextEmail: "recovery_incentive" as const, daysLeft, minDays: COUPON_DAYS }];
    } else {
      // Sin encuesta → próximo es encuesta. Calcular días hasta umbral.
      const minDays = surveyMinDays(c, rc);
      const daysLeft = Math.max(0, minDays - c.daysSinceLastOrder);
      return [{ c, nextEmail: "abandonment_survey" as const, daysLeft, minDays }];
    }
  }) : [];

  const allPending: PendingItem[] = [
    ...fullQueue.map(q => ({ c: q.c, nextEmail: q.automation, daysLeft: 0, minDays: surveyMinDays(q.c, rc) })),
    ...futureQueue,
  ].sort((a, b) => a.daysLeft - b.daysLeft || b.c.riskScore - a.c.riskScore);

  const queueTotal = allPending.length;
  const pendingSurvey = allPending.filter(p => p.nextEmail === "abandonment_survey").length;
  const pendingCoupon = allPending.filter(p => p.nextEmail === "recovery_incentive").length;
  const queue = allPending
    .slice(0, 50)
    .map(({ c, nextEmail, daysLeft, minDays }) => ({
      email: c.email, name: c.name, orders: c.orders, totalSpent: c.totalSpent,
      daysSinceLastOrder: c.daysSinceLastOrder, avgFrequencyDays: c.avgFrequencyDays,
      status: c.status, riskScore: c.riskScore, nextEmail,
      daysLeft, minDays,
    }));

  // ── Últimos envíos (7 días) con el estado actual del cliente ──
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const recentSends = enrollments
    .filter(e => e.sentAt && e.sentAt.getTime() >= sevenDaysAgo)
    .sort((a, b) => b.sentAt!.getTime() - a.sentAt!.getTime())
    .slice(0, 200)
    .map(e => {
      const c = clientByEmail.get(e.customerEmail.toLowerCase());
      return {
        automation: e.automation, sentAt: e.sentAt!.toISOString(), status: e.status,
        name: e.customerName, email: e.customerEmail, phone: e.customerPhone || null,
        clientStatus: c?.status ?? null,
        orders: c?.orders ?? null,
        daysSinceLastOrder: c?.daysSinceLastOrder ?? null,
        avgFrequencyDays: c?.avgFrequencyDays ?? null,
        minDays: c && e.automation !== "recovery_incentive" ? surveyMinDays(c, rc) : null,
        surveySentAt: e.automation === "recovery_incentive" ? (idx.surveySentAt.has(e.customerEmail.toLowerCase()) ? new Date(idx.surveySentAt.get(e.customerEmail.toLowerCase())!).toISOString() : null) : undefined,
      };
    });

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
      // Encuestas
      surveysSent: enrollments.filter(e => e.automation === "abandonment_survey" && e.sentAt).length,
      surveysOpened: enrollments.filter(e => e.automation === "abandonment_survey" && (e.openedAt || e.clickedAt || e.surveyAnsweredAt)).length,
      // Cupones
      couponsSent: enrollments.filter(e => e.automation === "recovery_incentive" && e.sentAt).length,
      couponsOpened: enrollments.filter(e => e.automation === "recovery_incentive" && (e.openedAt || e.clickedAt)).length,
      couponsUsed: enrollments.filter(e => e.automation === "recovery_incentive" && couponUsed(e)).length,
    },
    reasons,
    surveyResponses,
    couponRecipients: enrollments
      .filter(e => e.automation === "recovery_incentive" && e.sentAt)
      .slice(0, 20)
      .map(e => ({ name: e.customerName, email: e.customerEmail, phone: e.customerPhone || null, code: e.couponCode || null, sentAt: e.sentAt!.toISOString(), opened: !!(e.openedAt || e.clickedAt), used: couponUsed(e) })),
    byAutomation,
    recent,
    // Cola de próximos envíos: misma regla que el cron diario (customer-recovery),
    // así lo que se ve aquí es exactamente a quién le llegará el próximo email.
    queue,
    queueTotal, pendingSurvey, pendingCoupon,
    // Envíos de los últimos 7 días con el estado ACTUAL del cliente
    recentSends,
  });
}
