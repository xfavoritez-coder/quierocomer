/**
 * Crea o actualiza los 3 planes en Flow.
 *
 * Usage:
 *   npx tsx scripts/setup-flow-plans.ts
 *
 * Idempotente: si el plan ya existe, lo edita. Si no, lo crea.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { flowPost } from "../src/lib/billing/flow";
import { FLOW_PLANS } from "../src/lib/billing/plans-config";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
const URL_CALLBACK = `${BASE_URL}/api/billing/webhook`;

async function planExists(planId: string): Promise<boolean> {
  try {
    await flowPost("/plans/get", { planId });
    return true;
  } catch (err: any) {
    if (err.status === 400 || err.status === 404) return false;
    throw err;
  }
}

async function upsertPlan(planId: string, name: string, amount: number) {
  const params = {
    planId,
    name,
    amount,
    currency: "CLP",
    interval: 3,         // 3 = mensual
    interval_count: 1,
    periods_number: 0,   // 0 = infinito
    urlCallback: URL_CALLBACK,
  };

  if (await planExists(planId)) {
    console.log(`-> editando plan ${planId}`);
    return flowPost("/plans/edit", params);
  } else {
    console.log(`-> creando plan ${planId}`);
    return flowPost("/plans/create", params);
  }
}

async function main() {
  console.log(`Flow base: ${process.env.FLOW_API_URL}`);
  console.log(`Callback: ${URL_CALLBACK}\n`);

  for (const cfg of Object.values(FLOW_PLANS)) {
    const result = await upsertPlan(cfg.planId, cfg.name, cfg.amount);
    console.log(`   ${cfg.planId} ($${cfg.amount.toLocaleString("es-CL")}) ✓`);
  }
  console.log("\nListo. Los 3 planes estan sincronizados en Flow.");
}

main().catch((e) => {
  console.error("\nError:", e.message);
  process.exit(1);
});
