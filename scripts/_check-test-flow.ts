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
  const res = await fetch(`${FLOW_BASE}${endpoint}?${body}`);
  const data: any = await res.json();
  if (!res.ok) throw new Error(`${endpoint} ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  const sub = await flowGet("/subscription/get", { subscriptionId: "sus_ta12537aad" });
  const statusLabel = sub.status === 1 ? "✅ ACTIVE" : sub.status === 2 ? "⚠️ SUSPENDED" : "❌ CANCELLED";
  const moroseLabel = sub.morose === 0 ? "✅ Al día" : sub.morose === 1 ? "⚠️ Cobro pendiente" : "🆕 Sin cobro aún";
  console.log(`Status: ${statusLabel}`);
  console.log(`Morose: ${moroseLabel} (${sub.morose})`);
  console.log(`Plan: ${sub.planId}`);
  console.log(`next_invoice_date: ${sub.next_invoice_date}`);
  if (sub.invoices?.length) {
    const inv = sub.invoices[0];
    const invStatus = inv.status === 2 ? "✅ PAGADO" : inv.status === 0 ? "⏳ PENDIENTE" : `status=${inv.status}`;
    console.log(`\nInvoice: ${invStatus} — $${inv.amount} — intentos: ${inv.attemp_count}`);
    console.log(`next_attemp: ${inv.next_attemp_date || "—"}`);
  }
}
main().catch(console.error);
