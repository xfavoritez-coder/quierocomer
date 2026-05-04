/**
 * Elimina el plan qc_basic_monthly de Flow.
 * Ya no se usa: el modelo nuevo es FREE (gratis, sin Flow) / GOLD / PREMIUM.
 *
 * Uso: npx tsx scripts/delete-flow-basic.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { flowPost } from "../src/lib/billing/flow";

async function main() {
  console.log("Eliminando plan qc_basic_monthly de Flow...");
  try {
    await flowPost("/plans/delete", { planId: "qc_basic_monthly" });
    console.log("OK eliminado.");
  } catch (e: any) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}

main();
