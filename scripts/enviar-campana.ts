/**
 * Script para enviar campaña masiva a dueños de restaurante.
 *
 * Uso: npx tsx scripts/enviar-campana.ts
 *
 * 1. Lee los 716 contactos de la campaña de DeseoComer
 * 2. Crea una PlatformCampaign en la BD de QuieroComer
 * 3. Envía en lotes de 50 con resend.batch.send()
 * 4. Registra cada contacto con tracking
 */

import { PrismaClient as PrismaQC } from "@prisma/client";
import { PrismaClient as PrismaDC } from "../../deseocomer/node_modules/@prisma/client";
import { Resend } from "resend";
import { buildQuieroComerEmailHtml, CAMPAIGN_SUBJECT } from "./email-campana-quierocomer";

const RESEND_KEY = process.env.RESEND_API_KEY || "re_VXBZsdmT_JsnyY57KFCraYBeP62kjckFD";
const FROM = "QuieroComer <hola@quierocomer.cl>";
const REPLY_TO = "favoritez@gmail.com";
const BATCH_SIZE = 50;
const DELAY_MS = 2000;

// Campaign ID from DeseoComer (717 contacts = restaurant owners)
const DC_CAMPAIGN_ID = "cmnkb77di0000i604jrjpsfcu";

async function main() {
  const dcPrisma = new PrismaDC({
    datasources: { db: { url: "postgresql://postgres.ybsttlzviefwjafpbikc:DeseoComer2026!@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5" } },
  });
  const qcPrisma = new PrismaQC();
  const resend = new Resend(RESEND_KEY);

  // 1. Get contacts from DeseoComer (no unsubscribed)
  const contacts = await dcPrisma.contactoCampana.findMany({
    where: {
      campanaId: DC_CAMPAIGN_ID,
      OR: [{ errorEnvio: null }, { errorEnvio: "" }],
    },
    select: { email: true },
    orderBy: { email: "asc" },
  });
  await dcPrisma.$disconnect();

  console.log(`📋 ${contacts.length} contactos encontrados`);

  // 2. Create campaign in QuieroComer
  const campaign = await qcPrisma.platformCampaign.create({
    data: {
      subject: CAMPAIGN_SUBJECT,
      status: "sending",
      totalContacts: contacts.length,
    },
  });
  console.log(`🆔 Campaña creada: ${campaign.id}`);

  // 3. Create all contact records
  await qcPrisma.platformCampaignContact.createMany({
    data: contacts.map((c) => ({ campaignId: campaign.id, email: c.email })),
    skipDuplicates: true,
  });

  // 4. Send in batches
  let totalSent = 0;
  let totalErrors = 0;

  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);
    const emails = batch.map((c) => ({
      from: FROM,
      replyTo: REPLY_TO,
      to: c.email,
      subject: CAMPAIGN_SUBJECT,
      html: buildQuieroComerEmailHtml({ email: c.email, campaignId: campaign.id }),
    }));

    try {
      const result = await resend.batch.send(emails);
      const sentNow = result.data?.data?.length || batch.length;
      totalSent += sentNow;

      // Mark as sent
      const now = new Date();
      await qcPrisma.platformCampaignContact.updateMany({
        where: { campaignId: campaign.id, email: { in: batch.map((c) => c.email) } },
        data: { sentAt: now },
      });

      console.log(`✅ Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${sentNow} enviados (${totalSent}/${contacts.length})`);
    } catch (err: any) {
      totalErrors += batch.length;
      console.error(`❌ Lote ${Math.floor(i / BATCH_SIZE) + 1} falló:`, err?.message || err);

      // Mark errors
      await qcPrisma.platformCampaignContact.updateMany({
        where: { campaignId: campaign.id, email: { in: batch.map((c) => c.email) } },
        data: { errorMsg: err?.message || "batch_error" },
      });
    }

    // Rate limit pause
    if (i + BATCH_SIZE < contacts.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  // 5. Update campaign
  await qcPrisma.platformCampaign.update({
    where: { id: campaign.id },
    data: { status: "sent", totalSent, totalErrors, sentAt: new Date() },
  });

  console.log(`\n🏁 Campaña completada: ${totalSent} enviados, ${totalErrors} errores`);
  await qcPrisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
