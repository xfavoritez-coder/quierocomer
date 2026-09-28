import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
const prisma = new PrismaClient();

function buildSignedBody(params: Record<string, string | number>, apiKey: string, secret: string): URLSearchParams {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) clean[k] = String(v);
  clean.apiKey = apiKey;
  const sorted = Object.keys(clean).sort();
  const toSign = sorted.map((k) => `${k}=${clean[k]}`).join("&");
  const signature = crypto.createHmac("sha256", secret).update(toSign).digest("hex");
  const body = new URLSearchParams();
  for (const k of sorted) body.set(k, clean[k]);
  body.set("s", signature);
  return body;
}

async function flowGet(endpoint: string, params: Record<string, string | number>) {
  const apiKey = process.env.FLOW_API_KEY!;
  const secret = process.env.FLOW_SECRET_KEY!;
  const base = "https://www.flow.cl/api";
  const body = buildSignedBody(params, apiKey, secret);
  const url = `${base}${endpoint}?${body.toString()}`;
  const res = await fetch(url);
  const text = await res.text();
  const data = JSON.parse(text);
  if (!res.ok) throw new Error(`Flow ${endpoint} ${res.status}: ${data?.message || text}`);
  return data;
}

async function main() {
  const rs = await prisma.restaurant.findMany({
    where: { flowPlanId: "qc_premium_monthly", flowSubscriptionId: { not: null } },
    select: { id: true, name: true, flowSubscriptionId: true, currentPeriodEnd: true },
  });

  console.log(`Checking ${rs.length} subscriptions...\n`);

  for (const r of rs) {
    try {
      const sub = await flowGet("/subscription/get", { subscriptionId: r.flowSubscriptionId! });
      const statusLabel = sub.status === 1 ? "✅ ACTIVE" : sub.status === 2 ? "⚠️ SUSPENDED" : sub.status === 3 ? "❌ CANCELLED" : `unknown(${sub.status})`;
      console.log(`${r.name}`);
      console.log(`  subscriptionId: ${r.flowSubscriptionId}`);
      console.log(`  Flow status: ${statusLabel}`);
      console.log(`  planId en Flow: ${sub.planId}`);
      console.log(`  nextPaymentDate: ${sub.nextPaymentDate || "—"}`);
      console.log(`  currentPeriodEnd (DB): ${r.currentPeriodEnd}`);
      console.log();
    } catch (err: any) {
      console.log(`${r.name}: ERROR — ${err.message}\n`);
    }
  }

  await prisma.$disconnect();
}
main();
