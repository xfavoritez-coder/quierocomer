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

// Flow tiene varios codigos/mensajes para "plan no existe". Esta lista
// reune los que vimos en produccion + sandbox.
function isPlanNotFoundError(err: any): boolean {
  const msg = String(err?.message || "").toLowerCase();
  return (
    msg.includes("not found") ||
    msg.includes("does not exist") ||
    msg.includes("no existe") ||
    msg.includes("plan no encontrado")
  );
}

function isPlanAlreadyExistsError(err: any): boolean {
  const msg = String(err?.message || "").toLowerCase();
  return (
    msg.includes("already been used") ||
    msg.includes("already exists") ||
    msg.includes("ya existe") ||
    msg.includes("ya ha sido")
  );
}

/**
 * Idempotent upsert estrategia:
 * 1. Intenta /plans/get para obtener monto actual (no critica)
 * 2. Intenta /plans/edit. Si funciona, listo.
 * 3. Si edit falla con "plan no existe", intenta /plans/create.
 * 4. Si create falla con "ya existe" (race condition o error transient en
 *    el get), reintenta /plans/edit.
 */
async function upsertPlan(
  planId: string,
  name: string,
  amountGross: number,
): Promise<Pick<SyncResult, "action" | "previousAmount" | "error">> {
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

  // Intentar leer monto actual (best effort, sin fallar si Flow devuelve raro)
  let previousAmount: number | undefined;
  try {
    const existing = await flowPost<{ amount?: number }>("/plans/get", { planId });
    previousAmount = existing?.amount;
  } catch {
    // Ignoramos — si /plans/get falla, edit/create se encargara.
  }

  if (previousAmount === amountGross) {
    return { action: "no_change", previousAmount };
  }

  // Intentar editar primero
  try {
    await flowPost("/plans/edit", params);
    return { action: "updated", previousAmount };
  } catch (editErr: any) {
    if (!isPlanNotFoundError(editErr)) {
      // Editar fallo por algo distinto a "no existe" → reportar error
      return { action: "error", error: editErr?.message || String(editErr), previousAmount };
    }
  }

  // Edit dijo "no existe" → crear
  try {
    await flowPost("/plans/create", params);
    return { action: "created" };
  } catch (createErr: any) {
    if (isPlanAlreadyExistsError(createErr)) {
      // Race: alguien lo creo justo ahora — reintentar edit
      try {
        await flowPost("/plans/edit", params);
        return { action: "updated", previousAmount };
      } catch (retryErr: any) {
        return { action: "error", error: retryErr?.message || String(retryErr), previousAmount };
      }
    }
    return { action: "error", error: createErr?.message || String(createErr), previousAmount };
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
