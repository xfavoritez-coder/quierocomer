import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { flowPost } from "@/lib/billing/flow";
import { FLOW_PLANS, grossOf, ivaOf } from "@/lib/billing/plans-config";

/**
 * POST /api/admin/billing/sync-flow-plans
 *
 * Solo superadmin. Crea o actualiza los planes en Flow.cl con el monto BRUTO
 * (neto + 19% IVA). Reemplaza el script `scripts/setup-flow-plans.ts` para
 * casos donde no se tienen las credenciales en local: se ejecuta directo
 * desde producción con la sesión del superadmin.
 *
 * Idempotente: si el plan ya existe lo edita, si no lo crea.
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
const URL_CALLBACK = `${BASE_URL}/api/billing/webhook`;

type SyncResult = {
  planId: string;
  name: string;
  amountNet: number;
  amountIva: number;
  amountGross: number;
  action: "created" | "updated" | "no_change" | "error";
  previousAmount?: number;
  error?: string;
};

async function getPlan(planId: string): Promise<{ amount?: number } | null> {
  try {
    return await flowPost("/plans/get", { planId });
  } catch (err: any) {
    if (err?.status === 400 || err?.status === 404) return null;
    if (err?.message?.includes("not found") || err?.message?.includes("does not exist")) return null;
    throw err;
  }
}

async function upsertPlan(
  planId: string,
  name: string,
  amountGross: number,
): Promise<Pick<SyncResult, "action" | "previousAmount" | "error">> {
  try {
    const existing = await getPlan(planId);
    const params = {
      planId,
      name,
      amount: amountGross,
      currency: "CLP",
      interval: 3, // 3 = mensual en Flow
      interval_count: 1,
      periods_number: 0, // 0 = infinito
      urlCallback: URL_CALLBACK,
    };

    if (!existing) {
      await flowPost("/plans/create", params);
      return { action: "created" };
    }
    if (existing.amount === amountGross) {
      return { action: "no_change", previousAmount: existing.amount };
    }
    await flowPost("/plans/edit", params);
    return { action: "updated", previousAmount: existing.amount };
  } catch (err: any) {
    return { action: "error", error: err?.message || String(err) };
  }
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) {
    return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  }

  if (!process.env.FLOW_API_KEY || !process.env.FLOW_SECRET_KEY) {
    return NextResponse.json(
      { error: "FLOW_API_KEY o FLOW_SECRET_KEY no configuradas en el entorno" },
      { status: 500 },
    );
  }

  const results: SyncResult[] = [];
  for (const cfg of Object.values(FLOW_PLANS)) {
    const net = cfg.amountNet;
    const iva = ivaOf(net);
    const gross = grossOf(net);
    const outcome = await upsertPlan(cfg.planId, cfg.name, gross);
    results.push({
      planId: cfg.planId,
      name: cfg.name,
      amountNet: net,
      amountIva: iva,
      amountGross: gross,
      ...outcome,
    });
  }

  const ok = results.every((r) => r.action !== "error");
  return NextResponse.json({
    ok,
    flowApiUrl: process.env.FLOW_API_URL || "https://sandbox.flow.cl/api",
    callbackUrl: URL_CALLBACK,
    results,
  }, { status: ok ? 200 : 207 });
}
