// ═══════════════════════════════════════════════════════════
//  Prueba de punta a punta de SharkPOS en SANDBOX (guía de agentes).
//  Correr:  node --env-file=.env.local scripts/sharkpos-sandbox/e2e.mjs
//  Requiere SHARKPOS_API_KEY (sandbox) en el entorno. NO toca producción.
//
//  Pasos (de la guía):
//   1. Emitir una boleta.
//   2. Repetir con la MISMA Idempotency-Key → 200, mismo folio (replay).
//   3. Esperar el resultado del SII (polling hasta is_final) y descargar el PDF.
//   4. Provocar un 400 y confirmar que se muestra el mensaje SIN reintentar.
// ═══════════════════════════════════════════════════════════

import { writeFile } from "node:fs/promises";

const BASE = "https://sandbox.sharkpos.cl";
const KEY = process.env.SHARKPOS_API_KEY;
if (!KEY) {
  console.error("❌ Falta SHARKPOS_API_KEY (sandbox) en el entorno (.env.local).");
  process.exit(1);
}

const headers = (idem) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${KEY}`,
  ...(idem ? { "Idempotency-Key": idem } : {}),
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const line = () => console.log("─".repeat(60));

async function emit(idem, body) {
  const res = await fetch(`${BASE}/api/v1/dte/boleta/emit/`, {
    method: "POST",
    headers: headers(idem),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function getDoc(dteId) {
  const res = await fetch(`${BASE}/api/v1/dte/documents/${dteId}/`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  const idem = `e2e-${Date.now()}`;
  // Boleta válida: amount_total = suma de qty*price (con IVA).
  const body = {
    document_type: 39,
    amount_total: 11980,
    items: [
      { name: "Roll California", qty: 1, price: 6990 },
      { name: "Bebida lata", qty: 2, price: 2495 },
    ],
  };

  line();
  console.log("PASO 1 — Emitir boleta  |  Idempotency-Key:", idem);
  const r1 = await emit(idem, body);
  console.log("  HTTP", r1.status, "· status:", r1.data.status, "· folio:", r1.data.folio, "· dte_id:", r1.data.dte_id);
  console.log("  public_status:", r1.data.public_status ?? "(async)", "· dte_status:", r1.data.dte_status);
  if (r1.status !== 201) {
    console.error("  ❌ Se esperaba 201. Abortando.", JSON.stringify(r1.data).slice(0, 400));
    process.exit(1);
  }
  const dteId = r1.data.dte_id;
  const folio1 = r1.data.folio;
  console.log("  ✅ Emitida. folio", folio1);

  line();
  console.log("PASO 2 — Reintento idempotente (misma key + mismo body)");
  const r2 = await emit(idem, body);
  console.log("  HTTP", r2.status, "· idempotency_replayed:", r2.data.idempotency_replayed, "· folio:", r2.data.folio);
  if (r2.status === 200 && r2.data.folio === folio1) {
    console.log("  ✅ Replay correcto: mismo folio, sin reservar otro.");
  } else {
    console.log("  ⚠️ Esperaba 200 con mismo folio. Revisar.", JSON.stringify(r2.data).slice(0, 300));
  }

  line();
  console.log("PASO 3 — Esperar resultado del SII (polling hasta is_final)");
  let doc = null;
  const waits = [2000, 3000, 5000, 8000, 10000, 15000, 20000];
  for (let i = 0; i < waits.length; i++) {
    await sleep(waits[i]);
    const r = await getDoc(dteId);
    doc = r.data;
    console.log(`  intento ${i + 1}: public_status=${doc.public_status} is_final=${doc.is_final} requires_attention=${doc.requires_attention} code=${doc.code ?? ""}`);
    if (doc.is_final) break;
  }
  if (doc?.is_final && !doc.requires_attention) {
    console.log("  ✅ Documento final y aceptado:", doc.public_status);
  } else if (doc?.is_final) {
    console.log("  ⚠️ Final pero requiere atención:", doc.public_status, doc.code, doc.message);
  } else {
    console.log("  ⏳ Aún no es final en el tiempo de espera (en prod lo confirma el webhook).");
  }

  let pdfUrl = r1.data.pdf_url || doc?.links?.pdf || r1.data.links?.pdf;
  if (pdfUrl && pdfUrl.startsWith("/")) pdfUrl = BASE + pdfUrl; // links vienen relativos
  if (pdfUrl) {
    try {
      const pres = await fetch(pdfUrl, { headers: headers() });
      if (pres.ok) {
        const buf = Buffer.from(await pres.arrayBuffer());
        const out = `/tmp/sharkpos-boleta-${folio1}.pdf`;
        await writeFile(out, buf);
        console.log(`  ✅ PDF descargado (${(buf.length / 1024).toFixed(1)} KB) → ${out}`);
      } else {
        console.log("  ⚠️ No se pudo descargar el PDF:", pres.status, pdfUrl);
      }
    } catch (e) {
      console.log("  ⚠️ Error descargando PDF:", String(e));
    }
  } else {
    console.log("  ⚠️ Sin URL de PDF todavía.");
  }

  line();
  console.log("PASO 4 — Provocar un 400 (amount_total ≠ suma) — NO se reintenta");
  const bad = { document_type: 39, amount_total: 99999, items: [{ name: "Item", qty: 1, price: 1000 }] };
  const r4 = await emit(`e2e-bad-${Date.now()}`, bad);
  console.log("  HTTP", r4.status, "· code:", r4.data.code, "· message:", r4.data.message);
  if (r4.status >= 400 && r4.status < 500) {
    console.log("  ✅ Error de cliente mostrado tal cual, sin reintentar.");
  } else {
    console.log("  ⚠️ Esperaba 4xx.", JSON.stringify(r4.data).slice(0, 300));
  }

  line();
  console.log("E2E SANDBOX COMPLETO.");
}

main().catch((e) => {
  console.error("❌ Error inesperado en el E2E:", e);
  process.exit(1);
});
