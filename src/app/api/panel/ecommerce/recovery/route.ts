import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { isSuperAdmin } from "@/lib/adminAuth";
import { getClientSegmentation, type ClientRow } from "@/lib/ecommerce/client-segmentation";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";
import { pickAutomation, surveyMinDays, indexEnrollments } from "@/lib/ecommerce/recovery-eligibility";
import { readImportedClients, buildImportedChurnedClients } from "@/lib/ecommerce/recoveryImport";
import { chileDayStart, toChileDateStr } from "@/lib/promoDates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Extrae items de un pedido (OnlineOrder o PosOrder). Ambos guardan items como Json
 *  pero con formatos ligeramente distintos. */
function parseOrderItems(items: unknown): { name: string; qty: number; price: number }[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((it: Record<string, unknown>) => {
    const name = String(it.name ?? it.productName ?? it.title ?? it.description ?? "").trim();
    if (!name) return [];
    const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
    const price = Number(it.unitPrice ?? it.price ?? 0) || 0;
    return [{ name, qty, price }];
  });
}

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  if (isSuperAdmin(req)) return true;
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) return teamMemberCanAccess(panelId.slice(3), restaurantId);
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

async function resolveAllIds(restaurantId: string, thisR: { ownerId: string | null } | null) {
  let allIds = [restaurantId];
  if (thisR?.ownerId) {
    const siblings = await prisma.restaurant.findMany({ where: { ownerId: thisR.ownerId }, select: { id: true } });
    if (siblings.length > 1) allIds = siblings.map(s => s.id);
  }
  return allIds;
}

/** GET /api/panel/ecommerce/recovery?restaurantId=X[&section=queue]
 *  Sin section: KPIs rápidos (solo enrollments, sin segmentación de clientes).
 *  section=queue: datos pesados (cola de pendientes, envíos recientes). Se carga lazy. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  const section = req.nextUrl.searchParams.get("section") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const thisR = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true, ecommerceStoreConfig: true } });
  const allIds = await resolveAllIds(restaurantId, thisR);

  // Enrollments (de toda la marca) — siempre se necesitan
  const enrollments = await prisma.recoveryEnrollment.findMany({
    where: { restaurantId: { in: allIds } },
    select: { restaurantId: true, automation: true, status: true, sentAt: true, openedAt: true, clickedAt: true, convertedAt: true, convertedOrderId: true, couponCode: true, surveyReason: true, surveyDetail: true, surveyComment: true, surveyAnsweredAt: true, createdAt: true, customerName: true, customerEmail: true, customerPhone: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const couponCodes = enrollments.filter(e => e.automation === "recovery_incentive" && e.couponCode).map(e => e.couponCode!);
  const couponUses = couponCodes.length
    ? await prisma.ecommerceCouponUse.findMany({ where: { couponCode: { in: couponCodes } }, select: { couponCode: true, orderId: true } })
    : [];
  const useByCode = new Map(couponUses.map(u => [u.couponCode, u]));
  const couponUsed = (e: { couponCode: string | null }) => !!e.couponCode && useByCode.has(e.couponCode);

  // ══════════════════════════════════════════════════════════════
  //  section=queue → datos pesados (segmentación + cola)
  // ══════════════════════════════════════════════════════════════
  if (section === "queue") {
    const realClients = await getClientSegmentation(restaurantId);
    const existingEmails = new Set(realClients.filter(c => c.email).map(c => c.email.toLowerCase()));
    const importedClients = buildImportedChurnedClients(readImportedClients(thisR?.ecommerceStoreConfig), existingEmails, restaurantId);
    const clients = [...realClients, ...importedClients];
    const churned = clients.filter(c => c.status === "churned");
    const churnedWithEmail = churned.filter(c => !!c.email);

    const clientByEmail = new Map<string, ClientRow>();
    for (const c of clients) if (c.email) clientByEmail.set(c.email.toLowerCase(), c);

    const rc = parseStoreConfig(thisR?.ecommerceStoreConfig).recovery;
    const since180 = Date.now() - 180 * 86400000;
    const idx = indexEnrollments(enrollments.filter(e => e.createdAt.getTime() >= since180));
    const candidateEmails = churnedWithEmail.map(c => c.email!.toLowerCase());
    const unsubscribed = new Set<string>();
    if (candidateEmails.length) {
      const unsubs = await prisma.qRUser.findMany({ where: { email: { in: candidateEmails, mode: "insensitive" }, unsubscribedAt: { not: null } }, select: { email: true } });
      for (const u of unsubs) if (u.email) unsubscribed.add(u.email.toLowerCase());
    }
    const brandRests = await prisma.restaurant.findMany({ where: { id: { in: allIds } }, select: { id: true, ecommerceStoreConfig: true } });
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
    type PendingItem = { c: ClientRow; nextEmail: string; daysLeft: number; minDays: number };
    const COUPON_DAYS = 3;
    const futureQueue: PendingItem[] = rc.enabled ? churnedWithEmail.flatMap((c): PendingItem[] => {
      const em = c.email!.toLowerCase();
      if (unsubscribed.has(em)) return [];
      if (idx.hasEnrollment.has(`${em}::abandonment_survey`) && idx.hasEnrollment.has(`${em}::recovery_incentive`)) return [];
      if (fullQueue.some(q => q.c.email?.toLowerCase() === em)) return [];
      const hasSurvey = idx.hasEnrollment.has(`${em}::abandonment_survey`);
      if (hasSurvey) {
        const surveyAt = idx.surveySentAt.get(em);
        const daysSinceSurvey = surveyAt ? Math.round((Date.now() - surveyAt) / 86400000) : 0;
        const daysLeft = Math.max(0, COUPON_DAYS - daysSinceSurvey);
        return [{ c, nextEmail: "recovery_incentive" as const, daysLeft, minDays: COUPON_DAYS }];
      } else {
        const minDays = surveyMinDays(c, rc);
        const daysLeft = Math.max(0, minDays - c.daysSinceLastOrder);
        return [{ c, nextEmail: "abandonment_survey" as const, daysLeft, minDays }];
      }
    }) : [];

    const allPending: PendingItem[] = [
      ...fullQueue.map(q => ({ c: q.c, nextEmail: q.automation, daysLeft: 0, minDays: surveyMinDays(q.c, rc) })),
      ...futureQueue,
    ].sort((a, b) => a.daysLeft - b.daysLeft || b.c.riskScore - a.c.riskScore);

    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const startOfTodayMs = chileDayStart(toChileDateStr(new Date()))?.getTime() ?? (Date.now() - 86400000);
    const sentWithin7d = enrollments.filter(e => e.sentAt && e.sentAt.getTime() >= sevenDaysAgo);
    // Conteos REALES (no limitados por el tope de la lista de abajo), para las
    // pestañas "Hoy (N)" / "7 días (N)". Antes la UI usaba el largo de la lista
    // capada → siempre mostraba el tope (200) aunque se enviaran más.
    const recentTotals = {
      week: sentWithin7d.length,
      today: sentWithin7d.filter(e => e.sentAt!.getTime() >= startOfTodayMs).length,
    };
    const recentSends = sentWithin7d
      .sort((a, b) => b.sentAt!.getTime() - a.sentAt!.getTime())
      .slice(0, 1000)
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
      queueTotal: allPending.length,
      pendingSurvey: allPending.filter(p => p.nextEmail === "abandonment_survey").length,
      pendingCoupon: allPending.filter(p => p.nextEmail === "recovery_incentive").length,
      queue: allPending.slice(0, 50).map(({ c, nextEmail, daysLeft, minDays }) => ({
        email: c.email, name: c.name, orders: c.orders, totalSpent: c.totalSpent,
        daysSinceLastOrder: c.daysSinceLastOrder, avgFrequencyDays: c.avgFrequencyDays,
        status: c.status, riskScore: c.riskScore, nextEmail, daysLeft, minDays,
      })),
      recentSends,
      recentTotals,
      // Stats de clientes que solo se usan en este endpoint
      atRisk: clients.filter(c => c.status === "at_risk").length,
      churned: churned.length,
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  Default: KPIs rápidos (solo enrollments, sin segmentación)
  // ══════════════════════════════════════════════════════════════

  // KPIs deduplicados por email
  const sentEmails = new Set(enrollments.filter(e => e.sentAt).map(e => e.customerEmail.toLowerCase()));
  const sent = { length: sentEmails.size };
  const convertedEmails = new Set(enrollments.filter(e => e.status === "converted" || couponUsed(e)).map(e => e.customerEmail.toLowerCase()));
  const converted = { length: convertedEmails.size };
  const openedEmails = new Set(enrollments.filter(e => e.clickedAt || e.surveyAnsweredAt || e.status === "clicked" || e.status === "converted" || couponUsed(e)).map(e => e.customerEmail.toLowerCase()));
  const opened = { length: openedEmails.size };

  // Ingresos recuperados
  let recoveredRevenue = 0;
  if (converted.length > 0) {
    const convertedEnrollments = enrollments.filter(e => e.status === "converted" || couponUsed(e));
    const onlineIdSet = new Set<string>();
    const posIdSet = new Set<string>();
    for (const e of convertedEnrollments) {
      if (couponUsed(e)) { const oid = useByCode.get(e.couponCode!)?.orderId; if (oid) onlineIdSet.add(oid); }
      else if (e.convertedOrderId) posIdSet.add(e.convertedOrderId);
    }
    const [onlineOrders, posOrders] = await Promise.all([
      [...onlineIdSet].length ? prisma.onlineOrder.findMany({ where: { id: { in: [...onlineIdSet] } }, select: { total: true, deliveryFee: true } }) : [],
      [...posIdSet].length ? prisma.posOrder.findMany({ where: { id: { in: [...posIdSet] } }, select: { totalAmount: true, deliveryFee: true, tipAmount: true } }) : [],
    ]);
    recoveredRevenue =
      onlineOrders.reduce((s, o) => s + Math.max(0, (o.total || 0) - (o.deliveryFee || 0)), 0) +
      posOrders.reduce((s, o) => s + Math.max(0, (o.totalAmount || 0) - (o.deliveryFee || 0) - (o.tipAmount || 0)), 0);
  }

  // Detalle de clientes recuperados
  type RecoveredClient = { name: string | null; email: string; phone: string | null; orderId: string; orderTotal: number; orderDate: string; branchName: string | null; usedCoupon: boolean; items: { name: string; qty: number; price: number }[] };
  const recoveredClients: RecoveredClient[] = [];
  if (converted.length > 0) {
    const convertedEnrollmentsList = enrollments.filter(e => e.status === "converted" || couponUsed(e));
    const seenRecoveredEmail = new Set<string>();
    for (const e of convertedEnrollmentsList) {
      const em = e.customerEmail.toLowerCase();
      if (seenRecoveredEmail.has(em)) continue;
      seenRecoveredEmail.add(em);
      const oid = couponUsed(e) ? useByCode.get(e.couponCode!)?.orderId : e.convertedOrderId;
      if (!oid) continue;
      const oo = await prisma.onlineOrder.findUnique({
        where: { id: oid },
        select: { id: true, total: true, deliveryFee: true, createdAt: true, items: true, restaurant: { select: { name: true, ecommerceStoreConfig: true } } },
      });
      if (oo) {
        const branchCfg = oo.restaurant?.ecommerceStoreConfig as Record<string, unknown> | null;
        const branchName = (branchCfg?.branchName as string) || null;
        const items = parseOrderItems(oo.items);
        recoveredClients.push({
          name: e.customerName, email: e.customerEmail, phone: e.customerPhone || null,
          orderId: oo.id, orderTotal: Math.max(0, (oo.total || 0) - (oo.deliveryFee || 0)),
          orderDate: oo.createdAt.toISOString(), branchName, usedCoupon: couponUsed(e), items,
        });
      } else {
        const po = await prisma.posOrder.findUnique({
          where: { id: oid },
          select: { id: true, totalAmount: true, deliveryFee: true, tipAmount: true, createdAt: true, items: true, customerName: true, restaurant: { select: { name: true, ecommerceStoreConfig: true } } },
        });
        if (po) {
          const branchCfg = po.restaurant?.ecommerceStoreConfig as Record<string, unknown> | null;
          const branchName = (branchCfg?.branchName as string) || null;
          const items = parseOrderItems(po.items);
          recoveredClients.push({
            name: po.customerName || e.customerName, email: e.customerEmail, phone: e.customerPhone || null,
            orderId: po.id, orderTotal: Math.max(0, (po.totalAmount || 0) - (po.deliveryFee || 0) - (po.tipAmount || 0)),
            orderDate: po.createdAt.toISOString(), branchName, usedCoupon: couponUsed(e), items,
          });
        }
      }
    }
  }

  // Razones de abandono
  const reasons = enrollments
    .filter(e => e.surveyReason)
    .reduce((acc, e) => { acc[e.surveyReason!] = (acc[e.surveyReason!] || 0) + 1; return acc; }, {} as Record<string, number>);

  // Respuestas de encuesta (deduplicadas por email)
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
        totalSpent: 0,
      });
    }
  }
  const surveyResponses = [...surveyResponseMap.values()];

  // Total de compras de quienes respondieron (solo esos correos, para no cargar
  // toda la segmentación en la fase rápida). Mismo neto que la segmentación:
  // total − despacho − propina, en toda la marca; los pedidos web ya espejados
  // al POS (externalId "oo-<id>") no se cuentan dos veces.
  if (surveyResponses.length) {
    const emails = surveyResponses.map(r => r.customerEmail.toLowerCase());
    const [posOrders, onlineOrders] = await Promise.all([
      prisma.posOrder.findMany({
        where: { restaurantId: { in: allIds }, posStatus: { not: "canceled" }, customerEmail: { in: emails, mode: "insensitive" } },
        select: { externalId: true, customerEmail: true, totalAmount: true, deliveryFee: true, tipAmount: true },
      }),
      prisma.onlineOrder.findMany({
        where: {
          restaurantId: { in: allIds }, source: "ecommerce", status: { not: "CANCELLED" },
          customerEmail: { in: emails, mode: "insensitive" },
          OR: [{ paymentStatus: "paid" }, { paymentMethod: { notIn: ["webpay", "flow", "mercadopago"] } }],
        },
        select: { id: true, customerEmail: true, total: true, deliveryFee: true },
      }),
    ]);
    const spent = new Map<string, number>();
    const add = (em: string | null, n: number) => { if (em) spent.set(em.toLowerCase(), (spent.get(em.toLowerCase()) ?? 0) + Math.max(0, n)); };
    const mirrored = new Set<string>();
    for (const o of posOrders) {
      if (o.externalId?.startsWith("oo-")) mirrored.add(o.externalId.slice(3));
      add(o.customerEmail, (o.totalAmount || 0) - (o.deliveryFee || 0) - (o.tipAmount || 0));
    }
    for (const o of onlineOrders) if (!mirrored.has(o.id)) add(o.customerEmail, (o.total || 0) - (o.deliveryFee || 0));
    for (const r of surveyResponses) r.totalSpent = spent.get(r.customerEmail.toLowerCase()) ?? 0;
  }

  // Actividad reciente
  const recent = enrollments.slice(0, 30).map(e => ({
    automation: e.automation, status: e.status,
    customerName: e.customerName, customerEmail: e.customerEmail,
    couponCode: e.couponCode || null, surveyReason: e.surveyReason || null,
    sentAt: e.sentAt?.toISOString() || null, openedAt: e.openedAt?.toISOString() || null,
    clickedAt: e.clickedAt?.toISOString() || null, convertedAt: e.convertedAt?.toISOString() || null,
    createdAt: e.createdAt.toISOString(),
  }));

  // Por automatización
  const byAutomation: Record<string, { sent: number; opened: number; converted: number }> = {};
  for (const e of enrollments) {
    if (!byAutomation[e.automation]) byAutomation[e.automation] = { sent: 0, opened: 0, converted: 0 };
    if (e.sentAt) byAutomation[e.automation].sent++;
    if (e.status === "opened" || e.status === "clicked" || e.status === "converted") byAutomation[e.automation].opened++;
    if (e.status === "converted") byAutomation[e.automation].converted++;
  }

  // Cupón recipients (todos, deduplicados por email)
  const couponRecipientMap = new Map<string, { name: string | null; email: string; phone: string | null; code: string | null; sentAt: string; opened: boolean; used: boolean }>();
  for (const e of enrollments) {
    if (e.automation !== "recovery_incentive" || !e.sentAt) continue;
    const key = e.customerEmail.toLowerCase();
    if (!couponRecipientMap.has(key)) {
      couponRecipientMap.set(key, {
        name: e.customerName, email: e.customerEmail, phone: e.customerPhone || null,
        code: e.couponCode || null, sentAt: e.sentAt.toISOString(),
        opened: !!(e.clickedAt), used: couponUsed(e),
      });
    }
  }
  const couponRecipients = [...couponRecipientMap.values()];

  return NextResponse.json({
    kpis: {
      contacted: sent.length,
      opened: opened.length,
      responded: surveyResponses.length,
      recovered: converted.length,
      recoveryRate: sent.length > 0 ? Math.round((converted.length / sent.length) * 100) : 0,
      recoveredRevenue,
      surveysSent: enrollments.filter(e => e.automation === "abandonment_survey" && e.sentAt).length,
      surveysOpened: enrollments.filter(e => e.automation === "abandonment_survey" && (e.clickedAt || e.surveyAnsweredAt)).length,
      couponsSent: enrollments.filter(e => e.automation === "recovery_incentive" && e.sentAt).length,
      couponsOpened: enrollments.filter(e => e.automation === "recovery_incentive" && (e.clickedAt || couponUsed(e))).length,
      couponsUsed: enrollments.filter(e => e.automation === "recovery_incentive" && couponUsed(e)).length,
    },
    reasons,
    surveyResponses,
    couponRecipients,
    byAutomation,
    recent,
    recoveredClients,
  });
}
