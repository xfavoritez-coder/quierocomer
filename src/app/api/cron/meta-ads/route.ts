import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Cron — meta-ads
 *
 * Activa/pausa campaña y ajusta presupuesto diario según día de la semana.
 *
 * Horario CLT (UTC-3 verano):
 *   activate:   16:00 CLT lun-sáb  → 19:00 UTC
 *   deactivate: 22:00 CLT lun-sáb  → 01:00 UTC día siguiente
 *
 * Presupuesto diario (CLP):
 *   Lun-Jue: $10.000
 *   Vie-Sáb: $15.000
 *
 * Env vars:
 *   META_ADS_TOKEN     — System User token con ads_management
 *   META_CAMPAIGN_ID   — ID de la campaña
 */

export const maxDuration = 20;

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";

// Presupuestos en CLP (Meta usa la unidad base para monedas sin decimales como CLP)
const BUDGET_WEEKDAY = 10000;  // lun-jue
const BUDGET_WEEKEND = 15000;  // vie-sáb

async function metaPost(campaignId: string, payload: Record<string, any>) {
  const token = process.env.META_ADS_TOKEN;
  if (!token) throw new Error("META_ADS_TOKEN no configurado");

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${campaignId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, access_token: token }),
    signal: AbortSignal.timeout(10000),
  });

  const data = await res.json() as any;
  if (!res.ok || data.error) {
    throw new Error(`Meta API error: ${JSON.stringify(data.error || data)}`);
  }
  return data;
}

function getChileTime(): { day: number; hour: number } {
  const now = new Date();
  const chile = new Date(now.toLocaleString("en-US", { timeZone: "America/Santiago" }));
  return { day: chile.getDay(), hour: chile.getHours() };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const keyParam = req.nextUrl.searchParams.get("key");
  const validCron = !process.env.CRON_SECRET || authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const validKey = process.env.SEED_SECRET && keyParam === process.env.SEED_SECRET;
  if (!validCron && !validKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = req.nextUrl.searchParams.get("action");
  if (action !== "activate" && action !== "deactivate") {
    return NextResponse.json({ error: "action debe ser 'activate' o 'deactivate'" }, { status: 400 });
  }

  // cid en query param permite apuntar a una campaña distinta sin nueva env var
  const campaignId = req.nextUrl.searchParams.get("cid") || process.env.META_CAMPAIGN_ID;
  if (!campaignId) return NextResponse.json({ error: "META_CAMPAIGN_ID no configurado" }, { status: 500 });

  const start = Date.now();
  const jobName = `meta-ads-${action}-${campaignId}`;
  try {
    const { day, hour } = getChileTime();
    const dayName = ["dom","lun","mar","mié","jue","vie","sáb"][day];
    const results: Record<string, any> = { chileHour: hour, chileDay: dayName, campaignId };

    // Verificar que estamos en la hora correcta en Chile (±1h de tolerancia)
    const expectedHour = action === "activate" ? 16 : 22;
    if (Math.abs(hour - expectedHour) > 1) {
      console.log(`[meta-ads] Skip — hora Chile actual: ${hour}:xx, esperada: ${expectedHour}:xx`);
      await prisma.cronLog.create({
        data: { jobName, status: "success", durationMs: Date.now() - start, details: { skipped: true, reason: "wrong_hour", chileHour: hour, expectedHour } as any },
      }).catch(() => {});
      return NextResponse.json({ ok: true, skipped: true, reason: "wrong_hour", chileHour: hour, expectedHour });
    }

    if (action === "activate") {
      // 1. Activar campaña
      results.status = await metaPost(campaignId, { status: "ACTIVE" });

      // 2. Presupuesto según día: vie(5) o sáb(6) = $15.000, resto = $10.000
      const isWeekend = day === 5 || day === 6;
      const budget = isWeekend ? BUDGET_WEEKEND : BUDGET_WEEKDAY;
      results.budget = await metaPost(campaignId, { daily_budget: budget });
      results.budgetSet = budget;

      console.log(`[meta-ads] Activada + presupuesto $${budget.toLocaleString("es-CL")} (${dayName})`);
    } else {
      results.status = await metaPost(campaignId, { status: "PAUSED" });
      console.log(`[meta-ads] Pausada (${dayName})`);
    }

    await prisma.cronLog.create({
      data: { jobName, status: "success", durationMs: Date.now() - start, details: results as any },
    }).catch(() => {});

    return NextResponse.json({ ok: true, action, ...results });
  } catch (err: any) {
    console.error(`[meta-ads] Error:`, err.message);
    await prisma.cronLog.create({
      data: { jobName, status: "error", durationMs: Date.now() - start, error: err.message },
    }).catch(() => {});
    return NextResponse.json({ ok: false, action, error: err.message }, { status: 500 });
  }
}
