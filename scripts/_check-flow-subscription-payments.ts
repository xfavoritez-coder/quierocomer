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

async function flowGet(endpoint: string, params: Record<string, string>): Promise<any> {
  const body = sign(params);
  const url = `${FLOW_BASE}${endpoint}?${body}`;
  const res = await fetch(url);
  const data: any = await res.json();
  if (!res.ok) throw new Error(`${endpoint} ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  const subId = "sus_x81228e866"; // La Oveja Negra

  console.log("=== Suscripción ===");
  const sub = await flowGet("/subscription/get", { subscriptionId: subId });
  console.log(JSON.stringify(sub, null, 2));

  console.log("\n=== Intentando cobros de suscripción ===");
  try {
    const invoices = await flowGet("/subscription/invoice/list", { subscriptionId: subId });
    console.log(JSON.stringify(invoices, null, 2));
  } catch (e: any) { console.log("invoice/list:", e.message); }

  try {
    const charges = await flowGet("/subscription/getCharges", { subscriptionId: subId });
    console.log(JSON.stringify(charges, null, 2));
  } catch (e: any) { console.log("getCharges:", e.message); }

  try {
    const history = await flowGet("/subscription/history", { subscriptionId: subId });
    console.log(JSON.stringify(history, null, 2));
  } catch (e: any) { console.log("history:", e.message); }
}
main().catch(console.error);
