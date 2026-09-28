import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
const prisma = new PrismaClient();

const FLOW_API_KEY = "76B3192F-71CF-436F-B21E-71740CDL45A4";
const FLOW_SECRET = "879a5a53a1920bd2592c9f8f6cea7cb568e96c34";
const FLOW_BASE = "https://www.flow.cl/api";

function sign(params: Record<string, string>): URLSearchParams {
  const all: Record<string, string> = { ...params, apiKey: FLOW_API_KEY };
  const sorted = Object.keys(all).sort();
  const toSign = sorted.map(k => `${k}=${all[k]}`).join("&");
  const sig = crypto.createHmac("sha256", FLOW_SECRET).update(toSign).digest("hex");
  const body = new URLSearchParams();
  sorted.forEach(k => body.set(k, all[k]));
  body.set("s", sig);
  return body;
}

async function flowGet(endpoint: string, params: Record<string, string>): Promise<any> {
  const body = sign(params);
  const res = await fetch(`${FLOW_BASE}${endpoint}?${body}`);
  const data: any = await res.json();
  if (!res.ok) throw new Error(`${endpoint} ${res.status}: ${data?.message}`);
  return data;
}

async function flowPost(endpoint: string, params: Record<string, string>): Promise<any> {
  const body = sign(params);
  const res = await fetch(`${FLOW_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(`${endpoint} ${res.status}: ${data?.message}`);
  return data;
}

async function main() {
  const restaurants = await prisma.restaurant.findMany({
    where: { flowPlanId: "qc_premium_monthly", flowSubscriptionId: { not: null }, subscriptionStatus: "ACTIVE" },
    select: { id: true, name: true, flowSubscriptionId: true },
  });

  console.log(`\n🔍 Verificando ${restaurants.length} suscripciones en Flow...\n`);

  for (const r of restaurants) {
    const subId = r.flowSubscriptionId!;
    try {
      const sub = await flowGet("/subscription/get", { subscriptionId: subId });
      const statusLabel = sub.status === 1 ? "✅ ACTIVE" : sub.status === 2 ? "⚠️ SUSPENDED" : "❌ CANCELLED";
      console.log(`${r.name}`);
      console.log(`  Flow status: ${statusLabel}  planId: ${sub.planId}  nextPayment: ${sub.nextPaymentDate || "—"}`);

      try {
        const mod = await flowPost("/subscription/modify", {
          subscriptionId: subId,
          planId: "qc_monthly",
        });
        console.log(`  ✅ Migrado a qc_monthly — ${JSON.stringify(mod).slice(0, 200)}`);
        await prisma.restaurant.update({
          where: { id: r.id },
          data: { flowPlanId: "qc_monthly" },
        });
        console.log(`  ✅ DB actualizada\n`);
      } catch (err: any) {
        console.log(`  ❌ Error al migrar: ${err.message}\n`);
      }
    } catch (err: any) {
      console.log(`${r.name}: ERROR al consultar — ${err.message}\n`);
    }
  }

  await prisma.$disconnect();
}
main();
