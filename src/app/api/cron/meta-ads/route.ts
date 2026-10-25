import { NextRequest, NextResponse } from "next/server";

/**
 * Cron — meta-ads
 *
 * Activa o pausa una campaña de Meta Ads según la acción indicada.
 * Se dispara via vercel.json:
 *   - activate:   16:00 CLT lun-sáb  (19:00 UTC en horario de verano, 20:00 en invierno)
 *   - deactivate: 22:00 CLT lun-sáb  (01:00 UTC siguiente día en verano, 02:00 en invierno)
 *
 * Env vars requeridas:
 *   META_ADS_TOKEN      — access token con permiso ads_management (System User token, no expira)
 *   META_CAMPAIGN_ID    — ID de la campaña a activar/pausar
 *   META_GRAPH_VERSION  — opcional, default "v21.0"
 */

export const maxDuration = 20;

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";

async function setCampaignStatus(status: "ACTIVE" | "PAUSED"): Promise<{ success: boolean; data: any }> {
  const token = process.env.META_ADS_TOKEN;
  const campaignId = process.env.META_CAMPAIGN_ID;

  if (!token || !campaignId) {
    throw new Error("META_ADS_TOKEN o META_CAMPAIGN_ID no configurados");
  }

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${campaignId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, access_token: token }),
    signal: AbortSignal.timeout(10000),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Meta API error: ${JSON.stringify(data.error || data)}`);
  }
  return { success: true, data };
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

  const status = action === "activate" ? "ACTIVE" : "PAUSED";

  try {
    const result = await setCampaignStatus(status);
    console.log(`[meta-ads] Campaña ${status}: ok`, result.data);
    return NextResponse.json({ ok: true, action, status, data: result.data });
  } catch (err: any) {
    console.error(`[meta-ads] Error al ${action}:`, err.message);
    return NextResponse.json({ ok: false, action, error: err.message }, { status: 500 });
  }
}
