/**
 * Sends the "nuevas funciones" campaign to all owners with their real restaurant data.
 * Run:
 *   node scripts/send-batch-new-features.mjs --test   → solo a favoritez@gmail.com
 *   node scripts/send-batch-new-features.mjs --dry    → lista sin enviar
 *   node scripts/send-batch-new-features.mjs          → envía a todos (lotes de 90)
 */
import { PrismaClient } from "@prisma/client";
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

const DRY  = process.argv.includes("--dry");
const TEST = process.argv.includes("--test");
const TEST_TO = "favoritez@gmail.com";

const FROM    = "QuieroComer <hola@quierocomer.cl>";
const SUBJECT = "Algo nuevo llegó a tu panel (te va a encantar)";
const PURPOSE = "new_features_loyalty_valoraciones_jul2026";
const BATCH   = 90;

const prisma = new PrismaClient();

function buildHtml({ restaurantName, restaurantSlug, logoUrl }) {
  const link = `https://quierocomer.com/${restaurantSlug}`;

  // Preview del local personalizado con logo/nombre reales
  const localPreview = `
    <div style="background:#1a1a1a;border-radius:14px;border:1px solid #2a2a2a;overflow:hidden;">
      <div style="padding:22px 18px 16px;border-bottom:1px solid #222;text-align:center;">
        ${logoBlock(logoUrl, restaurantName)}
        <p style="margin:0;font-size:16px;font-weight:800;color:#fff;">${restaurantName}</p>
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
        <a href="${link}" style="font-size:12px;color:#F4A623;font-family:monospace;text-decoration:none;">${link}</a>
      </div>
    </div>`;

  const valoracionesPreview = `
    <div style="background:#1e1e1e;border-radius:12px;padding:16px 18px;border:1px solid #2a2a2a;text-align:center;">
      <span style="font-size:22px;display:block;margin-bottom:6px;">⭐</span>
      <p style="margin:0;font-size:13px;font-weight:700;color:#fff;">Déjanos tu opinión</p>
      <p style="margin:4px 0 0;font-size:11px;color:#555;">Tu opinión es privada y va directo al local</p>
    </div>`;

  const loyaltyPreview = `
    <div style="background:linear-gradient(135deg,#1a3a2a,#0f2018);border-radius:12px;padding:18px 20px;border:1px solid #1e3d2a;text-align:center;">
      <div style="width:36px;height:36px;border-radius:50%;background:#F4A623;text-align:center;line-height:36px;font-size:16px;display:inline-block;margin-bottom:8px;">🏪</div>
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#fff;">${restaurantName}</p>
      <div style="margin-bottom:6px;">
        <span style="font-size:20px;">⭐</span><span style="font-size:20px;">⭐</span><span style="font-size:20px;">⭐</span><span style="font-size:20px;opacity:.2;">⭐</span><span style="font-size:20px;opacity:.2;">⭐</span><span style="font-size:20px;opacity:.2;">⭐</span><span style="font-size:20px;opacity:.2;">⭐</span><span style="font-size:20px;opacity:.2;">⭐</span>
      </div>
      <p style="margin:0;font-size:11px;color:#3a6a4a;">3 de 8 · Sigue acumulando</p>
    </div>`;

  return buildNovedadesEmail({
    heroTitle:    "Tu panel<br/>acaba de crecer.",
    heroSubtitle: "Tres cosas nuevas. Diseñadas para que tus clientes vuelvan, te recomienden y te encuentren más fácil.",
    blocks: [
      featureCard({
        title:   "Tu local, una sola página",
        body:    `Ahora cada restaurante tiene su propia página con todo centralizado. Compártela en Instagram, WhatsApp o donde quieras. <strong style="color:#ccc;">Tu QR actual sigue funcionando igual — no hay que cambiar nada.</strong> Los links que aparecen abajo dependen de los módulos que tengas activos en tu panel.`,
        preview: localPreview,
      }),
      featureCard({
        title:   "Valoraciones",
        body:    "Un botón en tu página que invita a los clientes a dejarte una reseña. Elige si van a Google Maps o si te escriben directo a ti — en ese caso solo tú las ves en el panel.",
        preview: valoracionesPreview,
      }),
      featureCard({
        title:   "Tarjeta de fidelización",
        body:    "Dale a tus clientes una razón para volver. Crea tu programa de sellos digital — ellos acumulan, tú los premias. Sin apps, sin papel, todo desde su celular.",
        preview: loyaltyPreview,
      }),
    ],
    ctaUrl:  "https://quierocomer.com/panel",
    ctaText: "Ver mi panel →",
    ctaNote: "Ya está disponible — entra y configúralo en minutos.",
  });
}

async function main() {
  const all = await prisma.restaurantOwner.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      email: true,
      name: true,
      restaurants: {
        select: { id: true, name: true, slug: true, logoUrl: true },
        take: 1,
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Solo owners con email y al menos un restaurante
  const owners = all.filter(o => o.email?.trim() && o.restaurants.length > 0);

  const logs = await prisma.emailLog.findMany({
    where: { purpose: PURPOSE },
    select: { to: true },
  });
  const sentSet = new Set(logs.map(l => l.to.toLowerCase()));

  const pending = owners.filter(o => !sentSet.has(o.email.toLowerCase()));
  const batch   = TEST ? pending.slice(0, 1) : pending.slice(0, BATCH);

  console.log(`Total owners con restaurante: ${owners.length}`);
  console.log(`Ya enviados: ${sentSet.size}`);
  console.log(`Pendientes: ${pending.length}`);
  console.log(`Este lote: ${batch.length}`);
  if (TEST) console.log("→ Modo TEST: enviando a", TEST_TO);

  if (DRY) {
    console.log("\n-- DRY RUN --");
    batch.forEach(o => console.log(`  ${o.email} → ${o.restaurants[0].name} (${o.restaurants[0].slug})`));
    await prisma.$disconnect();
    return;
  }

  if (batch.length === 0) {
    console.log("Todos los owners ya recibieron el correo.");
    await prisma.$disconnect();
    return;
  }

  let sent = 0;
  const errors = [];

  for (const owner of batch) {
    const rest = owner.restaurants[0];
    const html = buildHtml({
      restaurantName: rest.name,
      restaurantSlug: rest.slug,
      logoUrl: rest.logoUrl,
    });
    const to = TEST ? TEST_TO : owner.email;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: [to], subject: SUBJECT, html }),
      });

      if (res.ok) {
        if (!TEST) {
          await prisma.emailLog.create({
            data: { to: owner.email, subject: SUBJECT, purpose: PURPOSE, status: "sent" },
          });
        }
        sent++;
        process.stdout.write(`✓ ${to} → ${rest.name}\n`);
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = `${to}: ${JSON.stringify(err)}`;
        errors.push(msg);
        process.stdout.write(`✗ ${msg}\n`);
      }
    } catch (e) {
      const msg = `${to}: ${e.message}`;
      errors.push(msg);
      process.stdout.write(`✗ ${msg}\n`);
    }

    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n✓ Enviados: ${sent} | Errores: ${errors.length} | Restantes: ${pending.length - sent}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
