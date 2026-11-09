/**
 * Envía encuestas de satisfacción a los pedidos DONE de hoy en Kojo Recoleta y La Florida.
 * Corre directo contra la BD de producción, sin pasar por el endpoint HTTP.
 *
 * Uso:
 *   npx tsx scripts/send-kojo-surveys.ts
 */
import { config } from "dotenv";
config({ path: ".env.prod" });

import { Client } from "pg";

// IDs de Kojo Recoleta y La Florida
const RESTAURANT_IDS = [
  "cmvcjbx090001jn074i0eg9zu", // Kojo Recoleta
  "cmubc0yoq0001jv041si8zicn", // Kojo La Florida
];

// IDs de pedidos a excluir (aún no despachados)
const EXCLUDE_ORDER_IDS = ["167", "168"];

function chileTodayRangeUtc(): { start: Date; end: Date } {
  // Fecha de hoy en Santiago (UTC-3)
  const now = new Date();
  const santiagoDiff = -3 * 60; // minutos
  const localOffset = now.getTimezoneOffset(); // minutos (positivo = atrás de UTC)
  const msOffset = (localOffset + santiagoDiff) * 60 * 1000;
  const santiago = new Date(now.getTime() - msOffset);
  const yyyy = santiago.getUTCFullYear();
  const mm = String(santiago.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(santiago.getUTCDate()).padStart(2, "0");
  const startSantiago = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000-03:00`);
  const endSantiago = new Date(`${yyyy}-${mm}-${dd}T23:59:59.999-03:00`);
  return { start: startSantiago, end: endSantiago };
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

async function sendSurveyEmail(args: {
  to: string;
  link: string;
  storeName: string;
  logoUrl?: string | null;
  accent: string;
  customerName?: string | null;
  subject: string;
  intro: string;
}): Promise<boolean> {
  const firstName = (args.customerName || "").trim().split(/\s+/)[0] || "";
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) { console.error("RESEND_API_KEY no encontrada"); return false; }

  const accent = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(args.accent) ? args.accent : "#e63946";
  const from = `${args.storeName} <hola@quierocomer.cl>`;
  const subject = args.subject || (firstName ? `${firstName}, ¿cómo estuvo tu pedido?` : "¿Cómo estuvo tu pedido?");
  const headerLogo = args.logoUrl
    ? `<img src="${esc(args.logoUrl)}" alt="${esc(args.storeName)}" height="52" style="max-height:52px;max-width:180px;object-fit:contain;display:block;margin:0 auto;" />`
    : `<span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px;">${esc(args.storeName)}</span>`;
  const saludo = firstName ? `${esc(firstName)}, ¿cómo estuvo todo?` : "¿Cómo estuvo todo?";
  const cuerpo = `Nos encantaría saber qué tal estuvo tu experiencia en <strong>${esc(args.storeName)}</strong>. Así sabemos cómo lo estamos haciendo y si hay algo que podamos mejorar para ti. Solo toma un momento.`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;">
<tr><td align="center" style="padding:32px 16px;">
<table width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;">
  <tr><td style="background:${accent};border-radius:12px 12px 0 0;padding:24px 28px;text-align:center;">
    ${headerLogo}
  </td></tr>
  <tr><td style="background:#ffffff;border-radius:0 0 12px 12px;padding:32px 28px;text-align:center;">
    <div style="font-size:40px;line-height:1;margin-bottom:14px;">⭐</div>
    <h1 style="font-size:20px;font-weight:800;color:#111;margin:0 0 10px;">${saludo}</h1>
    <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 24px;">${cuerpo}</p>
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center">
      <a href="${esc(args.link)}" style="display:inline-block;background:${accent};color:#fff;font-size:15px;font-weight:800;padding:14px 36px;border-radius:12px;text-decoration:none;">Calificar mi pedido →</a>
    </td></tr></table>
    <p style="font-size:12px;color:#ccc;margin:20px 0 0;">Si el botón no funciona: <a href="${esc(args.link)}" style="color:#aaa;">${esc(args.link)}</a></p>
  </td></tr>
  <tr><td align="center" style="padding:16px 0 0;">
    <span style="font-size:11px;color:#aaa;">Powered by QuieroComer.cl</span>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = `${firstName ? `${firstName}, ¿cómo estuvo todo?` : "¿Cómo estuvo todo?"}\n\nTu pedido en ${args.storeName} ya está entregado. Cuéntanos cómo fue:\n${args.link}`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({ from, to: args.to, subject, html, text }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`  ✗ Resend error:`, JSON.stringify(err));
      return false;
    }
    return true;
  } catch (e) {
    console.error(`  ✗ Error enviando:`, e);
    return false;
  }
}

async function main() {
  const db = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  await db.connect();

  const { start, end } = chileTodayRangeUtc();
  console.log(`Rango UTC: ${start.toISOString()} → ${end.toISOString()}`);

  // Obtener pedidos elegibles
  const { rows: candidates } = await db.query(
    `SELECT o.id, o."customerName", o."customerEmail",
            r.name AS "restaurantName", r."logoUrl", r."cartaAccentColor", r."ecommerceStoreConfig"
     FROM "OnlineOrder" o
     JOIN "Restaurant" r ON r.id = o."restaurantId"
     WHERE o."restaurantId" = ANY($1::text[])
       AND o.status = 'DONE'
       AND o."paymentStatus" IN ('paid', 'unpaid')
       AND o."surveySentAt" IS NULL
       AND o."customerEmail" IS NOT NULL
       AND o."updatedAt" >= $2
       AND o."updatedAt" <= $3
     ORDER BY o."updatedAt" ASC`,
    [RESTAURANT_IDS, start, end]
  );

  console.log(`\nPedidos elegibles encontrados: ${candidates.length}`);

  let sent = 0, skipped = 0;
  const emailProcessed = new Set<string>();

  for (const o of candidates) {
    // Excluir pedidos específicos
    if (EXCLUDE_ORDER_IDS.includes(o.id)) {
      console.log(`  → [EXCLUIDO] pedido ${o.id}`);
      skipped++;
      continue;
    }

    const email = (o.customerEmail as string).toLowerCase().trim();
    if (emailProcessed.has(email)) {
      console.log(`  → [DUP] ${email} (ya procesado en esta corrida)`);
      skipped++;
      continue;
    }

    // Parsear config de la tienda
    let cfg: Record<string, any> = {};
    try {
      const raw = o.ecommerceStoreConfig;
      cfg = typeof raw === "string" ? JSON.parse(raw) : (raw ?? {});
    } catch {}
    const survey = cfg.survey || {};
    const questions: any[] = Array.isArray(survey.questions) ? survey.questions : [];
    const activeQuestions = questions.filter((q: any) => q.active);

    if (activeQuestions.length === 0) {
      console.log(`  → [SIN PREGUNTAS] pedido ${o.id} ${email}`);
      skipped++;
      continue;
    }

    // Marcar surveySentAt atómicamente (si ya fue marcado por otro proceso, skip)
    const claimed = await db.query(
      `UPDATE "OnlineOrder" SET "surveySentAt" = NOW()
       WHERE id = $1 AND "surveySentAt" IS NULL
       RETURNING id`,
      [o.id]
    );
    if (claimed.rows.length === 0) {
      console.log(`  → [YA ENVIADO] pedido ${o.id}`);
      skipped++;
      continue;
    }

    // Construir link
    const customDomain = cfg.customDomain || null;
    const base = customDomain ? `https://${customDomain}` : "https://quierocomer.com";
    const link = `${base}/encuesta/${o.id}`;

    const accent = cfg.primaryColor || o.cartaAccentColor || "#e63946";
    const logoUrl = cfg.storeLogoUrl || o.logoUrl;

    // Preparar subject con variables
    let subjectTpl: string = survey.subject || "";
    const firstName = (o.customerName || "").trim().split(/\s+/)[0] || "";
    subjectTpl = subjectTpl
      .replace(/\{nombre\}/gi, firstName)
      .replace(/\{local\}/gi, o.restaurantName)
      .trim();
    if (!subjectTpl) {
      subjectTpl = firstName ? `${firstName}, ¿cómo estuvo tu pedido?` : "¿Cómo estuvo tu pedido?";
    }

    console.log(`  → Enviando a ${email} (pedido ${o.id}) ${o.restaurantName}...`);
    const ok = await sendSurveyEmail({
      to: o.customerEmail,
      link,
      storeName: o.restaurantName,
      logoUrl,
      accent,
      customerName: o.customerName,
      subject: subjectTpl,
      intro: survey.intro || "",
    });

    if (ok) {
      console.log(`    ✓ Enviado`);
      sent++;
      emailProcessed.add(email);
    } else {
      // Revertir surveySentAt si falló el envío
      await db.query(`UPDATE "OnlineOrder" SET "surveySentAt" = NULL WHERE id = $1`, [o.id]);
      console.log(`    ✗ Fallo, surveySentAt revertido`);
      skipped++;
    }
  }

  console.log(`\n=== Resultado ===`);
  console.log(`Escaneados: ${candidates.length}`);
  console.log(`Enviados:   ${sent}`);
  console.log(`Saltados:   ${skipped}`);

  await db.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
