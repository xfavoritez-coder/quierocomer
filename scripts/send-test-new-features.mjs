/**
 * Envía un preview del email de novedades a una dirección de prueba.
 * Run: node scripts/send-test-new-features.mjs
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildNovedadesEmail, logoBlock, featureCard } from "./email-novedades-template.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnv(file) {
  try {
    const content = readFileSync(join(ROOT, file), "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv(".env.local");
loadEnv(".env.prod");

const KEY = process.env.RESEND_API_KEY;
if (!KEY) { console.error("Missing RESEND_API_KEY"); process.exit(1); }

const TO      = "favoritez@gmail.com";
const FROM    = "QuieroComer <hola@quierocomer.cl>";
const SUBJECT = "Algo nuevo llegó a tu panel (te va a encantar)";

const localPreview = `
  <div style="background:#1a1a1a;border-radius:14px;border:1px solid #2a2a2a;overflow:hidden;">
    <div style="padding:22px 18px 16px;border-bottom:1px solid #222;text-align:center;">
      ${logoBlock(null, "Tu Restaurante")}
      <p style="margin:0;font-size:16px;font-weight:800;color:#fff;">Tu Restaurante</p>
    </div>
    <div style="padding:14px 16px;">
      <div style="background:#222;border-radius:10px;padding:12px 16px;margin-bottom:8px;text-align:center;">
        <span style="font-size:13px;color:#ccc;font-weight:600;">📋 Ver carta</span>
      </div>
      <div style="background:#222;border-radius:10px;padding:12px 16px;margin-bottom:8px;text-align:center;">
        <span style="font-size:13px;color:#ccc;font-weight:600;">🛒 Pedir online</span>
      </div>
      <div style="background:#222;border-radius:10px;padding:12px 16px;margin-bottom:8px;text-align:center;">
        <span style="font-size:13px;color:#ccc;font-weight:600;">🎁 Mi tarjeta de sellos</span>
      </div>
      <div style="background:#222;border-radius:10px;padding:12px 16px;text-align:center;">
        <span style="font-size:13px;color:#ccc;font-weight:600;">⭐ Déjanos tu opinión</span>
      </div>
    </div>
    <div style="padding:0 16px 14px;text-align:center;">
      <span style="font-size:12px;color:#F4A623;font-family:monospace;">quierocomer.com/tu-local</span>
    </div>
  </div>`;

const HTML = buildNovedadesEmail({
  heroTitle:    "Tu panel<br/>acaba de crecer.",
  heroSubtitle: "Tres cosas nuevas. Diseñadas para que tus clientes vuelvan, te recomienden y te encuentren más fácil.",
  blocks: [
    featureCard({
      title:   "Tu local, una sola página",
      body:    `Ahora cada restaurante tiene su propia página con todo centralizado. Compártela en Instagram, WhatsApp o donde quieras. <strong style="color:#ccc;">Tu QR actual sigue funcionando igual — no hay que cambiar nada.</strong>`,
      preview: localPreview,
    }),
    featureCard({
      title:   "Valoraciones",
      body:    "Un botón en tu página que invita a los clientes a dejarte una reseña. Elige si van a Google Maps o si te escriben directo a ti — en ese caso solo tú las ves en el panel.",
      preview: `
        <div style="background:#1e1e1e;border-radius:12px;padding:16px 18px;border:1px solid #2a2a2a;text-align:center;">
          <span style="font-size:22px;display:block;margin-bottom:6px;">⭐</span>
          <p style="margin:0;font-size:13px;font-weight:700;color:#fff;">Déjanos tu opinión</p>
          <p style="margin:4px 0 0;font-size:11px;color:#555;">Tu opinión es privada y va directo al local</p>
        </div>`,
    }),
    featureCard({
      title:   "Tarjeta de fidelización",
      body:    "Dale a tus clientes una razón para volver. Crea tu programa de sellos digital — ellos acumulan, tú los premias. Sin apps, sin papel, todo desde su celular.",
      preview: `
        <div style="background:linear-gradient(135deg,#1a3a2a,#0f2018);border-radius:12px;padding:18px 20px;border:1px solid #1e3d2a;text-align:center;">
          <div style="width:36px;height:36px;border-radius:50%;background:#F4A623;text-align:center;line-height:36px;font-size:16px;display:inline-block;margin-bottom:8px;">🏪</div>
          <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#fff;">Tu Restaurante</p>
          <div style="margin-bottom:6px;">
            <span style="font-size:20px;">⭐</span><span style="font-size:20px;">⭐</span><span style="font-size:20px;">⭐</span><span style="font-size:20px;opacity:.2;">⭐</span><span style="font-size:20px;opacity:.2;">⭐</span><span style="font-size:20px;opacity:.2;">⭐</span><span style="font-size:20px;opacity:.2;">⭐</span><span style="font-size:20px;opacity:.2;">⭐</span>
          </div>
          <p style="margin:0;font-size:11px;color:#3a6a4a;">3 de 8 · Sigue acumulando</p>
        </div>`,
    }),
  ],
  ctaUrl:  "https://quierocomer.com/panel",
  ctaText: "Ver mi panel →",
  ctaNote: "Ya está disponible — entra y configúralo en minutos.",
});

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ from: FROM, to: [TO], subject: SUBJECT, html: HTML }),
});

const data = await res.json();
if (res.ok) {
  console.log(`✓ Enviado a ${TO} — id: ${data.id}`);
} else {
  console.error("✗ Error:", JSON.stringify(data));
  process.exit(1);
}
