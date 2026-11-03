/**
 * Recupera el flowCustomerId de Flow por externalId=panelId y lo guarda en DB.
 * Usar cuando flowCustomerId quedó en null (ej: después de cancelar y resetear).
 */
import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

const FLOW_API_KEY = "76B3192F-71CF-436F-B21E-71740CDL45A4";
const FLOW_SECRET = "879a5a53a1920bd2592c9f8f6cea7cb568e96c34";
const FLOW_BASE = "https://app.flow.cl/api";

function sign(params: Record<string, string>) {
  const all = { ...params, apiKey: FLOW_API_KEY };
  const sorted = Object.keys(all).sort();
  const toSign = sorted.map(k => `${k}=${all[k]}`).join("&");
  const s = crypto.createHmac("sha256", FLOW_SECRET).update(toSign).digest("hex");
  return { ...all, s };
}

async function flowGet(endpoint: string, params: Record<string, string>) {
  const signed = sign(params);
  const qs = new URLSearchParams(signed).toString();
  const url = `${FLOW_BASE}${endpoint}?${qs}`;
  console.log(`GET ${url}`);
  const res = await fetch(url);
  const text = await res.text();
  console.log(`  → ${res.status}: ${text.slice(0, 300)}`);
  if (!res.ok) throw new Error(`${res.status}: ${text}`);
  return JSON.parse(text);
}

async function flowPost(endpoint: string, params: Record<string, string>) {
  const signed = sign(params);
  const body = new URLSearchParams(signed).toString();
  const url = `${FLOW_BASE}${endpoint}`;
  console.log(`POST ${url}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  console.log(`  → ${res.status}: ${text.slice(0, 300)}`);
  if (!res.ok) throw new Error(`${res.status}: ${text}`);
  return JSON.parse(text);
}

async function main() {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: "test-autocobro" },
    include: { owner: { select: { id: true, email: true } } },
  });
  console.log("Restaurant:", JSON.stringify(restaurant, null, 2));

  const panelId = (restaurant as any).owner?.id;
  const ownerEmail = (restaurant as any).owner?.email;
  console.log(`\npanelId: ${panelId}`);
  console.log(`ownerEmail: ${ownerEmail}`);

  // Intento 1: getByExternalId con panelId
  let customerId: string | null = null;
  console.log("\n--- Intento 1: getByExternalId ---");
  try {
    const r = await flowGet("/customer/getByExternalId", { externalId: panelId });
    customerId = r.customerId;
    console.log("✅ Encontrado:", r);
  } catch (e: any) {
    console.log("❌ Falló:", e.message);
  }

  // Intento 2: getList por email
  if (!customerId && ownerEmail) {
    console.log("\n--- Intento 2: getList por email ---");
    try {
      const r = await flowGet("/customer/getList", { filter: ownerEmail, start: "0", limit: "25" });
      console.log("Resultado getList:", JSON.stringify(r, null, 2));
      const match = Array.isArray(r?.data) ? r.data.find((c: any) => c.email === ownerEmail) : null;
      if (match?.customerId) {
        customerId = match.customerId;
        console.log("✅ Encontrado por email:", customerId);
      }
    } catch (e: any) {
      console.log("❌ Falló:", e.message);
    }
  }

  if (customerId) {
    console.log(`\n✅ customerId recuperado: ${customerId}`);
    await prisma.restaurant.update({
      where: { id: (restaurant as any).id },
      data: { flowCustomerId: customerId },
    });
    console.log("✅ Guardado en DB");
  } else {
    console.log("\n❌ No se pudo recuperar customerId. El cliente probablemente no existe en Flow todavía.");
  }

  await prisma.$disconnect();
}
main().catch(console.error);
