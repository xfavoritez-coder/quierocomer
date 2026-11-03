import { config } from "dotenv";
config({ path: ".env.prod" });
import crypto from "crypto";

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
  console.log("Creando plan de prueba en Flow...");
  try {
    const plan = await flowPost("/plans/create", {
      planId: "qc_test_1000",
      name: "QuieroComer Test",
      currency: "CLP",
      amount: "1190", // $1.000 neto + IVA = $1.190
      interval: "1",  // mensual
      interval_count: "1",
      trial_period_days: "0",
    });
    console.log("✅ Plan creado:", JSON.stringify(plan, null, 2));
  } catch (err: any) {
    console.log("❌", err.message);
  }
}
main();
