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

function logoBlock(logoUrl, name) {
  const initials = (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  if (logoUrl) {
    return `<img src="${logoUrl}" alt="" width="64" height="64" style="width:64px;height:64px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 12px;" />`;
  }
  return `<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#F4A623,#e8941a);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;font-family:Arial,sans-serif;margin:0 auto 12px;text-align:center;line-height:64px;">${initials}</div>`;
}

function buildHtml({ restaurantName, restaurantSlug, logoUrl }) {
  const link = `https://quierocomer.com/${restaurantSlug}`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Algo nuevo llegó</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;min-height:100vh;">
<tr><td align="center" style="padding:40px 16px 60px;">
<table width="100%" style="max-width:520px;" cellpadding="0" cellspacing="0">

  <!-- QC Logo -->
  <tr><td align="center" style="padding-bottom:36px;">
    <img src="https://quierocomer.com/logo.png" alt="QuieroComer" width="36" height="36" style="width:36px;height:36px;display:inline-block;" />
  </td></tr>

  <!-- Hero -->
  <tr><td align="center" style="padding-bottom:10px;">
    <p style="margin:0;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#555;font-weight:600;">Novedades</p>
  </td></tr>
  <tr><td align="center" style="padding-bottom:32px;">
    <h1 style="margin:0;font-size:32px;font-weight:800;color:#ffffff;line-height:1.15;letter-spacing:-.5px;">Tu panel<br/>acaba de crecer.</h1>
  </td></tr>
  <tr><td align="center" style="padding-bottom:44px;">
    <p style="margin:0;font-size:15px;color:#888;line-height:1.7;max-width:380px;">
      Tres cosas nuevas. Diseñadas para que tus clientes vuelvan, te recomienden y te encuentren más fácil.
    </p>
  </td></tr>

  <!-- Feature 1: Página principal -->
  <tr><td style="padding-bottom:16px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #222;border-radius:18px;overflow:hidden;">
      <tr><td style="padding:26px 28px 16px;">
        <p style="margin:0 0 6px;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#F4A623;font-weight:700;">Nuevo</p>
        <h2 style="margin:0 0 10px;font-size:19px;font-weight:800;color:#ffffff;">Tu local, una sola página</h2>
        <p style="margin:0;font-size:14px;color:#777;line-height:1.65;">
          Ahora cada restaurante tiene su propia página con todo centralizado. Compártela en Instagram, WhatsApp o donde quieras.
          <strong style="color:#ccc;">Tu QR actual sigue funcionando igual — no hay que cambiar nada.</strong>
          Los links que aparecen abajo dependen de los módulos que tengas activos en tu panel.
        </p>
      </td></tr>
      <tr><td style="padding:0 28px 24px;">
        <!-- Preview del local -->
        <div style="background:#1a1a1a;border-radius:14px;border:1px solid #2a2a2a;overflow:hidden;">
          <!-- Header centrado -->
          <div style="padding:22px 18px 16px;border-bottom:1px solid #222;text-align:center;">
            ${logoBlock(logoUrl, restaurantName)}
            <p style="margin:0;font-size:16px;font-weight:800;color:#fff;">${restaurantName}</p>
          </div>
          <!-- Links -->
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
          <!-- Link real -->
          <div style="padding:0 16px 14px;text-align:center;">
            <a href="${link}" style="font-size:12px;color:#F4A623;font-family:monospace;text-decoration:none;">${link}</a>
          </div>
        </div>
      </td></tr>
    </table>
  </td></tr>

  <!-- Feature 2: Valoraciones -->
  <tr><td style="padding-bottom:16px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #222;border-radius:18px;overflow:hidden;">
      <tr><td style="padding:26px 28px 20px;">
        <p style="margin:0 0 6px;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#F4A623;font-weight:700;">Nuevo</p>
        <h2 style="margin:0 0 10px;font-size:19px;font-weight:800;color:#ffffff;">Valoraciones</h2>
        <p style="margin:0;font-size:14px;color:#777;line-height:1.65;">
          Un botón en tu página que invita a los clientes a dejarte una reseña. Elige si van a Google Maps o si te escriben directo a ti — en ese caso solo tú las ves en el panel.
        </p>
      </td></tr>
      <tr><td style="padding:0 28px 24px;">
        <div style="background:#1e1e1e;border-radius:12px;padding:16px 18px;border:1px solid #2a2a2a;text-align:center;">
          <span style="font-size:22px;display:block;margin-bottom:6px;">⭐</span>
          <p style="margin:0;font-size:13px;font-weight:700;color:#fff;">Déjanos tu opinión</p>
          <p style="margin:4px 0 0;font-size:11px;color:#555;">Tu opinión es privada y va directo al local</p>
        </div>
      </td></tr>
    </table>
  </td></tr>

  <!-- Feature 3: Fidelización -->
  <tr><td style="padding-bottom:44px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #222;border-radius:18px;overflow:hidden;">
      <tr><td style="padding:26px 28px 20px;">
        <p style="margin:0 0 6px;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#F4A623;font-weight:700;">Nuevo</p>
        <h2 style="margin:0 0 10px;font-size:19px;font-weight:800;color:#ffffff;">Tarjeta de fidelización</h2>
        <p style="margin:0;font-size:14px;color:#777;line-height:1.65;">
          Dale a tus clientes una razón para volver. Crea tu programa de sellos digital — ellos acumulan, tú los premias. Sin apps, sin papel, todo desde su celular.
        </p>
      </td></tr>
      <tr><td style="padding:0 28px 24px;">
        <div style="background:linear-gradient(135deg,#1a3a2a,#0f2018);border-radius:12px;padding:18px 20px;border:1px solid #1e3d2a;text-align:center;">
          <div style="width:36px;height:36px;border-radius:50%;background:#F4A623;text-align:center;line-height:36px;font-size:16px;display:inline-block;margin-bottom:8px;">🏪</div>
          <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#fff;">${restaurantName}</p>
          <div style="margin-bottom:6px;">
            <span style="font-size:20px;">⭐</span><span style="font-size:20px;">⭐</span><span style="font-size:20px;">⭐</span><span style="font-size:20px;opacity:.2;">⭐</span><span style="font-size:20px;opacity:.2;">⭐</span><span style="font-size:20px;opacity:.2;">⭐</span><span style="font-size:20px;opacity:.2;">⭐</span><span style="font-size:20px;opacity:.2;">⭐</span>
          </div>
          <p style="margin:0;font-size:11px;color:#3a6a4a;">3 de 8 · Sigue acumulando</p>
        </div>
      </td></tr>
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td align="center" style="padding-bottom:48px;">
    <a href="https://quierocomer.com/panel" style="display:inline-block;background:linear-gradient(135deg,#ffc44f,#F4A623);color:#100b03;text-decoration:none;font-size:15px;font-weight:800;padding:16px 40px;border-radius:999px;letter-spacing:-.1px;">
      Ver mi panel →
    </a>
    <p style="margin:16px 0 0;font-size:13px;color:#999;font-weight:500;">
      Ya está disponible — entra y configúralo en minutos.
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="border-top:1px solid #222;padding-top:28px;" align="center">
    <p style="margin:0 0 4px;font-size:13px;color:#666;font-weight:700;letter-spacing:.05em;">QuieroComer</p>
    <p style="margin:0;font-size:11px;color:#444;">Marketing gastronómico</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
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
