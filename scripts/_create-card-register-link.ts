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

async function main() {
  const r = await prisma.restaurant.findUnique({
    where: { slug: "test-autocobro" },
    select: { id: true, name: true },
  });
  if (!r) { return; }

  const baseUrl = "https://quierocomer.com";
  const subscriptionId = "sus_y7bda9e824";

  // Guardar subscriptionId en DB para que el webhook lo encuentre
  await prisma.restaurant.update({
    where: { id: r.id },
    data: {
      flowSubscriptionId: subscriptionId,
      flowCustomerId: "cus_c381a635de",
      flowPlanId: "qc_test_1000",
      pendingFlowPlanId: "qc_test_1000",
      flowRegisterToken: null,
    },
  });

  // Crear link de registro de tarjeta para el customer
  const reg = await flowPost("/customer/register", {
    customerId: "cus_c381a635de",
    url_return: `${baseUrl}/panel`,
  });

  console.log(`✅ Link para registrar tu tarjeta:`);
  console.log(`   ${reg.url}?token=${reg.token}`);
  console.log(`\n   1. Entra al link y agrega tu tarjeta`);
  console.log(`   2. Flow intentará cobrar $1.190 automáticamente`);
  console.log(`   3. El webhook llegará y activará el autocobro en Test Autocobro`);

  await prisma.$disconnect();
}
main();
