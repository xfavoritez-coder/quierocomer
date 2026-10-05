import { config } from "dotenv";
config({ path: ".env.prod" });
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const FLOW_API_KEY = "76B3192F-71CF-436F-B21E-71740CDL45A4";
const FLOW_SECRET = "879a5a53a1920bd2592c9f8f6cea7cb568e96c34";
const FLOW_BASE = "https://www.flow.cl/api";
const prisma = new PrismaClient();

function sign(params: Record<string, string>): string {
  const all: Record<string, string> = { ...params, apiKey: FLOW_API_KEY };
  const sorted = Object.keys(all).sort();
  const toSign = sorted.map(k => `${k}=${all[k]}`).join("&");
  const sig = crypto.createHmac("sha256", FLOW_SECRET).update(toSign).digest("hex");
  const body = new URLSearchParams();
  sorted.forEach(k => body.set(k, all[k]));
  body.set("s", sig);
  return body.toString();
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

async function main() {
  const r = await prisma.restaurant.findUnique({
    where: { slug: "test-autocobro" },
    select: { id: true, flowSubscriptionId: true, flowCustomerId: true },
  });
  if (!r) { console.log("No encontrado"); return; }

  console.log("subscriptionId:", r.flowSubscriptionId);

  if (r.flowSubscriptionId) {
    try {
      const result = await flowPost("/subscription/cancel", { subscriptionId: r.flowSubscriptionId });
      console.log("Flow cancel:", JSON.stringify(result));
    } catch (e: any) {
      console.error("Error cancelando en Flow:", e.message);
    }
  }

  const updated = await prisma.restaurant.update({
    where: { id: r.id },
    data: {
      flowSubscriptionId: null,
      flowCustomerId: null,
      flowRegisterToken: null,
      pendingFlowPlanId: null,
      subscriptionStatus: "CANCELED",
    },
    select: { name: true, flowSubscriptionId: true, subscriptionStatus: true },
  });
  console.log("✅ DB actualizada:", JSON.stringify(updated, null, 2));
  await prisma.$disconnect();
}
main().catch(console.error);
