/**
 * Sends pedidos_online_email campaign in batches of 90.
 * Run: node scripts/send-batch-email.mjs [--dry]
 *
 * Reads DATABASE_URL from .env.local, RESEND_API_KEY from .env.prod
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Load env vars from .env.local and .env.prod
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

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CAMPAIGN_PURPOSE = "pedidos_online_email";
const BATCH_SIZE = 90;
const DRY = process.argv.includes("--dry");

if (!RESEND_API_KEY) {
  console.error("Missing RESEND_API_KEY");
  process.exit(1);
}

const prisma = new PrismaClient();

const FROM = "QuieroComer <hola@quierocomer.cl>";
const SUBJECT = "Nueva función: recibe pedidos online con tu nueva página";
const HTML_PATH = join(ROOT, "public", "preview-email-pedidos-online.html");
const htmlTemplate = readFileSync(HTML_PATH, "utf8");

async function main() {
  // All owners with email
  const all = await prisma.restaurantOwner.findMany({
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  const owners = all.filter((o) => o.email && o.email.trim() !== "");

  // Already sent
  const logs = await prisma.emailLog.findMany({
    where: { purpose: CAMPAIGN_PURPOSE },
    select: { to: true },
  });
  const sentSet = new Set(logs.map((l) => l.to.toLowerCase()));

  const pending = owners.filter((o) => !sentSet.has(o.email.toLowerCase()));
  const batch = pending.slice(0, BATCH_SIZE);

  console.log(`Total owners: ${owners.length}`);
  console.log(`Already sent: ${sentSet.size}`);
  console.log(`Pending: ${pending.length}`);
  console.log(`This batch: ${batch.length}`);

  if (DRY) {
    console.log("\n-- DRY RUN --");
    batch.forEach((o) => console.log(`  ${o.email} (${o.name})`));
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
    const html = htmlTemplate.replace(/\{\{email\}\}/g, encodeURIComponent(owner.email));

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: FROM, to: [owner.email], subject: SUBJECT, html }),
      });

      if (res.ok) {
        await prisma.emailLog.create({
          data: {
            to: owner.email,
            subject: SUBJECT,
            purpose: CAMPAIGN_PURPOSE,
            status: "sent",
          },
        });
        sent++;
        process.stdout.write(`✓ ${owner.email}\n`);
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = `${owner.email}: ${JSON.stringify(err)}`;
        errors.push(msg);
        process.stdout.write(`✗ ${msg}\n`);
      }
    } catch (e) {
      const msg = `${owner.email}: ${e.message}`;
      errors.push(msg);
      process.stdout.write(`✗ ${msg}\n`);
    }

    // 100ms throttle
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\n✓ Enviados: ${sent} | Errores: ${errors.length} | Restantes: ${pending.length - sent}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
