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
    select: { id: true, name: true, owner: { select: { email: true } } },
  });
  if (!r) { console.log("No encontrado"); return; }

  const baseUrl = "https://quierocomer.com";

  // Usar customer ya creado
  const customerId = "cus_c381a635de";

  // Crear checkout de suscripción en Flow con el plan de $1.000
  const result = await flowPost("/subscription/create", {
    planId: "qc_test_1000",
    customerId,
    urlReturn: `${baseUrl}/api/billing/subscribe-return?restaurantId=${r.id}`,
    urlConfirmation: `${baseUrl}/api/billing/webhook`,
  });

  console.log("✅ Respuesta Flow:", JSON.stringify(result, null, 2));
  console.log(`\n   Entra a este link, pon tu tarjeta → Flow cobra $1.190`);
  console.log(`   El webhook activa el autocobro en Test Autocobro`);

  // Guardar token en el restaurant para que el webhook lo encuentre
  await prisma.restaurant.update({
    where: { id: r.id },
    data: {
      flowRegisterToken: result.token,
      pendingFlowPlanId: "qc_test_1000",
      flowSubscriptionId: null, // limpiar el fake
    },
  });
  console.log(`\n   Token guardado en DB — webhook procesará correctamente`);

  await prisma.$disconnect();
}
main();
