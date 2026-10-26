import { NextRequest, NextResponse } from "next/server";

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

function getChileDay(): number {
  // Retorna el día de la semana en horario Chile (0=dom, 1=lun, ..., 6=sáb)
  const now = new Date();
  const chile = new Date(now.toLocaleString("en-US", { timeZone: "America/Santiago" }));
  return chile.getDay();
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = req.nextUrl.searchParams.get("action");
  if (action !== "activate" && action !== "deactivate") {
    return NextResponse.json({ error: "action debe ser 'activate' o 'deactivate'" }, { status: 400 });
  }

  const campaignId = process.env.META_CAMPAIGN_ID;
  if (!campaignId) return NextResponse.json({ error: "META_CAMPAIGN_ID no configurado" }, { status: 500 });

  try {
    const results: Record<string, any> = {};

    if (action === "activate") {
      // 1. Activar campaña
      results.status = await metaPost(campaignId, { status: "ACTIVE" });

      // 2. Ajustar presupuesto según día de la semana en Chile
      const day = getChileDay(); // 0=dom,1=lun,2=mar,3=mie,4=jue,5=vie,6=sáb
      const isWeekend = day === 5 || day === 6; // vie o sáb
      const budget = isWeekend ? BUDGET_WEEKEND : BUDGET_WEEKDAY;
      results.budget = await metaPost(campaignId, { daily_budget: budget });
      results.budgetSet = budget;
      results.dayOfWeek = ["dom","lun","mar","mié","jue","vie","sáb"][day];

      console.log(`[meta-ads] Activada + presupuesto $${budget.toLocaleString("es-CL")} (${results.dayOfWeek})`);
    } else {
      // Solo pausar
      results.status = await metaPost(campaignId, { status: "PAUSED" });
      console.log("[meta-ads] Campaña pausada");
    }

    return NextResponse.json({ ok: true, action, ...results });
  } catch (err: any) {
    console.error(`[meta-ads] Error:`, err.message);
    return NextResponse.json({ ok: false, action, error: err.message }, { status: 500 });
  }
}
