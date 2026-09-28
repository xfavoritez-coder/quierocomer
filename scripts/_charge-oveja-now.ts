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

async function flowPost(endpoint: string, params: Record<string, string>): Promise<any> {
  const body = sign(params);
  const res = await fetch(`${FLOW_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(`${endpoint} ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function flowGet(endpoint: string, params: Record<string, string>): Promise<any> {
  const body = sign(params);
  const res = await fetch(`${FLOW_BASE}${endpoint}?${body}`);
  const data: any = await res.json();
  if (!res.ok) throw new Error(`${endpoint} ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { name: { contains: "oveja", mode: "insensitive" } },
    select: { id: true, name: true, flowSubscriptionId: true, flowCustomerId: true, owner: { select: { email: true, name: true } } },
  });
  if (!r || !r.flowSubscriptionId) { console.log("No encontrado o sin suscripción"); return; }

  console.log(`\n${r.name}`);
  console.log(`subscriptionId: ${r.flowSubscriptionId}`);
  console.log(`customerId: ${r.flowCustomerId}`);

  // Intento 1: chargeNow en la suscripción
  console.log("\n1. Intentando /subscription/chargeNow...");
  try {
    const res = await flowPost("/subscription/chargeNow", {
      subscriptionId: r.flowSubscriptionId,
    });
    console.log("✅ chargeNow:", JSON.stringify(res, null, 2));
    await prisma.$disconnect();
    return;
  } catch (err: any) {
    console.log("❌", err.message);
  }

  // Intento 2: charge directo en el plan
  console.log("\n2. Intentando /subscription/charge...");
  try {
    const res = await flowPost("/subscription/charge", {
      subscriptionId: r.flowSubscriptionId,
    });
    console.log("✅ charge:", JSON.stringify(res, null, 2));
    await prisma.$disconnect();
    return;
  } catch (err: any) {
    console.log("❌", err.message);
  }

  // Si no funciona el cobro automático — crear pago manual por $53.431
  console.log("\n3. Creando link de pago manual por $53.431...");
  const commerceId = `rec_${r.id.slice(-8)}_${Date.now()}`;
  const baseUrl = "https://quierocomer.com";
  try {
    const payment = await flowPost("/payment/create", {
      commerceOrder: commerceId,
      subject: `QuieroComer · Renovación plan ${r.name} (sept 2026)`,
      currency: "CLP",
      amount: "53431",
      email: r.owner?.email || "",
      urlConfirmation: `${baseUrl}/api/billing/webhook`,
      urlReturn: `${baseUrl}/panel`,
    });
    console.log("✅ Link de pago creado:");
    console.log(`  URL: ${payment.url}?token=${payment.token}`);
    console.log(`  Token: ${payment.token}`);
    console.log(`  Enviar a: ${r.owner?.email}`);
  } catch (err: any) {
    console.log("❌ Error creando pago:", err.message);
  }

  await prisma.$disconnect();
}
main();
