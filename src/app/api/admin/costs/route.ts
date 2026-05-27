import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/costs?from=2026-05-20&to=2026-05-27
 *
 * Returns cost breakdown by service, by day, and per lead.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = searchParams.get("to") || new Date().toISOString().slice(0, 10);

  const dateFrom = new Date(`${from}T00:00:00Z`);
  const dateTo = new Date(`${to}T23:59:59Z`);

  const records = await prisma.apiUsage.findMany({
    where: { createdAt: { gte: dateFrom, lte: dateTo } },
    select: {
      service: true,
      action: true,
      model: true,
      leadId: true,
      inputTokens: true,
      outputTokens: true,
      costUsd: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // ─── By service ─────────────────────────────────────────────
  const byService: Record<string, { count: number; costUsd: number; inputTokens: number; outputTokens: number }> = {};
  for (const r of records) {
    const s = byService[r.service] || (byService[r.service] = { count: 0, costUsd: 0, inputTokens: 0, outputTokens: 0 });
    s.count++;
    s.costUsd += r.costUsd;
    s.inputTokens += r.inputTokens || 0;
    s.outputTokens += r.outputTokens || 0;
  }

  // ─── By day ─────────────────────────────────────────────────
  const byDay: Record<string, Record<string, number>> = {};
  for (const r of records) {
    const day = r.createdAt.toISOString().slice(0, 10);
    if (!byDay[day]) byDay[day] = {};
    byDay[day][r.service] = (byDay[day][r.service] || 0) + r.costUsd;
    byDay[day]._total = (byDay[day]._total || 0) + r.costUsd;
  }

  // ─── By action ──────────────────────────────────────────────
  const byAction: Record<string, { count: number; costUsd: number }> = {};
  for (const r of records) {
    const a = byAction[r.action] || (byAction[r.action] = { count: 0, costUsd: 0 });
    a.count++;
    a.costUsd += r.costUsd;
  }

  // ─── Per lead (top 20 most expensive) ───────────────────────
  const leadCosts: Record<string, number> = {};
  for (const r of records) {
    if (r.leadId) {
      leadCosts[r.leadId] = (leadCosts[r.leadId] || 0) + r.costUsd;
    }
  }
  const topLeads = Object.entries(leadCosts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([leadId, costUsd]) => ({ leadId, costUsd }));

  // Enrich top leads with names
  if (topLeads.length > 0) {
    const leads = await prisma.lead.findMany({
      where: { id: { in: topLeads.map(l => l.leadId) } },
      select: { id: true, localName: true },
    });
    const nameMap = new Map(leads.map(l => [l.id, l.localName]));
    for (const tl of topLeads) {
      (tl as any).localName = nameMap.get(tl.leadId) || "—";
    }
  }

  // ─── Totals ─────────────────────────────────────────────────
  const totalCostUsd = records.reduce((s, r) => s + r.costUsd, 0);
  const totalCalls = records.length;
  const uniqueLeads = new Set(records.filter(r => r.leadId).map(r => r.leadId)).size;
  const costPerLead = uniqueLeads > 0 ? totalCostUsd / uniqueLeads : 0;

  return NextResponse.json({
    from, to,
    totalCostUsd: +totalCostUsd.toFixed(4),
    totalCalls,
    uniqueLeads,
    costPerLead: +costPerLead.toFixed(4),
    byService,
    byDay,
    byAction,
    topLeads,
  });
}
