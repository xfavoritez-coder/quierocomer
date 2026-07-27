/**
 * Sends pedidos_online WA broadcast to all eligible owners.
 * Run: node scripts/send-wa-broadcast.mjs [--dry]
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

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+56962183197";
const TEMPLATE_SID = process.env.WA_TEMPLATE_PEDIDOS_ONLINE;

const BLACKLIST = new Set(["+56976485972", "+56977940643", "+56971204150"]);

const DRY = process.argv.includes("--dry");

const prisma = new PrismaClient();

async function sendWA(to, firstName) {
  const toNumber = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;

  const body = new URLSearchParams({
    From: FROM,
    To: toNumber,
    ContentSid: TEMPLATE_SID,
    ContentVariables: JSON.stringify({ "1": firstName }),
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data.sid;
}

async function main() {
  const owners = await prisma.restaurantOwner.findMany({
    where: { whatsapp: { not: null } },
    select: { id: true, name: true, whatsapp: true, email: true, restaurants: { select: { id: true, name: true }, take: 1 } },
  });

  const eligible = owners.filter(
    (o) => o.whatsapp && !BLACKLIST.has(o.whatsapp) && !(o.email || "").startsWith("import@")
  );

  console.log(`Elegibles: ${eligible.length}`);

  if (DRY) {
    console.log("\n-- DRY RUN --");
    eligible.slice(0, 10).forEach((o) => console.log(`  ${o.whatsapp} (${o.name})`));
    if (eligible.length > 10) console.log(`  ... y ${eligible.length - 10} más`);
    await prisma.$disconnect();
    return;
  }

  let sent = 0;
  const errors = [];

  for (const owner of eligible) {
    const firstName = owner.name.split(" ")[0];
    try {
      const sid = await sendWA(owner.whatsapp, firstName);

      const restaurantId = owner.restaurants[0]?.id;
      const msgBody = `Hola ${firstName}, desde ahora puedes recibir pedidos online con tu nueva página de pedidos. Tus clientes podrán pedir para retiro o delivery y el pedido te llegará a tu Whatsapp. Sin comisiones ni app de terceros.\n\n👉 Ve el demo: quierocomer.cl/pedir/el-menu-de-la-esquina\n🔧 Actívalo en tu panel: quierocomer.cl/panel`;

      if (restaurantId) {
        await prisma.whatsAppMessage.create({
          data: {
            phone: owner.whatsapp,
            direction: "OUTBOUND",
            body: msgBody,
            twilioSid: sid || "",
            status: "sent",
            restaurantId,
          },
        }).catch(() => {});

        await prisma.panelActivity.create({
          data: {
            restaurantId,
            action: "broadcast_pedidos_online",
            details: { sid, whatsapp: owner.whatsapp, ownerName: firstName },
          },
        }).catch(() => {});
      }

      sent++;
      process.stdout.write(`✓ ${owner.whatsapp} (${firstName})\n`);
    } catch (e) {
      const msg = `${owner.whatsapp} (${firstName}): ${e.message}`;
      errors.push(msg);
      process.stdout.write(`✗ ${msg}\n`);
    }

    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\n✓ Enviados: ${sent} | Errores: ${errors.length}`);
  if (errors.length) {
    console.log("Errores:");
    errors.forEach((e) => console.log(" ", e));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
