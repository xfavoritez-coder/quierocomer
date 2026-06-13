import { PrismaClient } from "@prisma/client";
import { computeLifecycleStage, OWNER_ACTIONS } from "../src/lib/admin/lifecycle";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const p = new PrismaClient();

const TEMPLATES: Record<string, string> = {
  nurturing_carta_no_revisada: "HX212aca9223fecaf089df099969e19a25",
  nurturing_vio_no_activo: "HXe8201d69e53b2c6c4c2af79470c34845",
  nurturing_no_volvio: "HXe8201d69e53b2c6c4c2af79470c34845",
};

const NURTURING_MAP: Record<string, { action: string }> = {
  LEAD_NO_VIO:        { action: "nurturing_carta_no_revisada" },
  LEAD_VIO_NO_ACTIVO: { action: "nurturing_vio_no_activo" },
  ACTIVADO_SIN_USO:   { action: "nurturing_no_volvio" },
  TRIAL_DORMIDO:      { action: "nurturing_no_volvio" },
  DORMIDO:            { action: "nurturing_no_volvio" },
};

const ACTION_MESSAGES: Record<string, (n: string, r: string) => string> = {
  nurturing_carta_no_revisada: (n, r) => `Hola ${n}, soy Camila de QuieroComer. Te escribo por la carta de ${r}, ya esta lista pero vi que aun no la revisas. Tienes alguna duda? — Camila de QuieroComer`,
  nurturing_vio_no_activo: (n, r) => `Hola ${n}, soy Camila de QuieroComer. Vi que revisaste la carta de ${r}. Necesitas ayuda o tienes alguna duda? — Camila de QuieroComer`,
  nurturing_no_volvio: (n, r) => `Hola ${n}, soy Camila de QuieroComer. Activaste ${r} pero no has vuelto. Todo bien? — Camila de QuieroComer`,
};

// The 20 approved phones
const TARGETS = new Set([
  "+56954085483", "+56928254931", "+56979226775", "+56962630150",
  "+56977977216", "+56931987171", "+56935883244", "+56992190784",
  "+56965720471", "+56966755571", "+56973046443", "+56950463340",
  "+56930350448", "+56954036360", "+56929966404", "+56940959137",
  "+56993502372", "+56999333286", "+56985845133", "+56986231842",
]);

async function sendWhatsApp(to: string, contentSid: string, vars: Record<string, string>): Promise<string | null> {
  const SID = process.env.TWILIO_ACCOUNT_SID;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
  if (!SID || !TOKEN) { console.error("Missing Twilio creds"); return null; }

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: FROM,
      To: `whatsapp:${to}`,
      ContentSid: contentSid,
      ContentVariables: JSON.stringify(vars),
    }),
  });
  const data = await res.json();
  if (!res.ok) { console.error(`Twilio error for ${to}:`, data.message); return null; }
  return data.sid || null;
}

async function main() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [restaurants, leads, allActivity, sessions7dGroups] = await Promise.all([
    p.restaurant.findMany({
      where: { ownerId: { not: null } },
      select: {
        id: true, name: true, slug: true, isDemo: true,
        plan: true, subscriptionStatus: true, trialEndsAt: true, billingExempt: true, createdAt: true,
        owner: { select: { name: true, whatsapp: true, lastLoginAt: true } },
      },
    }),
    p.lead.findMany({
      where: { generatedSlug: { not: null }, whatsapp: { not: null } },
      select: {
        id: true, generatedSlug: true, ownerName: true, whatsapp: true,
        cartaStatus: true, activated: true, emailClickedAt: true, whatsappClickedAt: true,
      },
    }),
    p.panelActivity.findMany({
      select: { restaurantId: true, action: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    p.session.groupBy({ by: ["restaurantId"], where: { startedAt: { gte: sevenDaysAgo } }, _count: true }),
  ]);

  const leadBySlug = new Map<string, typeof leads[0]>();
  for (const l of leads) { if (l.generatedSlug) leadBySlug.set(l.generatedSlug, l); }
  const activityByRest = new Map<string, typeof allActivity>();
  for (const a of allActivity) {
    if (!activityByRest.has(a.restaurantId)) activityByRest.set(a.restaurantId, []);
    activityByRest.get(a.restaurantId)!.push(a);
  }
  const sessions7dMap = new Map<string, number>();
  for (const s of sessions7dGroups) sessions7dMap.set(s.restaurantId, s._count);

  let sent = 0, failed = 0;

  for (const r of restaurants) {
    if (!r.owner?.whatsapp || !TARGETS.has(r.owner.whatsapp)) continue;

    const lead = leadBySlug.get(r.slug);
    const activity = activityByRest.get(r.id) || [];
    const sessions7d = sessions7dMap.get(r.id) || 0;
    const lastOwnerAct = activity.find(a => OWNER_ACTIONS.has(a.action));

    const stage = computeLifecycleStage({
      restaurant: {
        isDemo: r.isDemo, plan: r.plan, subscriptionStatus: r.subscriptionStatus,
        trialEndsAt: r.trialEndsAt, billingExempt: r.billingExempt,
        ownerLastLoginAt: r.owner.lastLoginAt, hasOwner: true,
      },
      lead: lead ? {
        cartaStatus: lead.cartaStatus, emailClickedAt: lead.emailClickedAt,
        whatsappClickedAt: lead.whatsappClickedAt, activated: lead.activated,
      } : null,
      lastOwnerActivity: lastOwnerAct?.createdAt || null,
      sessions7d,
    }, now);

    const nurturing = NURTURING_MAP[stage];
    if (!nurturing) { console.log(`  SKIP ${r.name} — stage ${stage} no tiene nurturing`); continue; }

    const templateSid = TEMPLATES[nurturing.action];
    const firstName = (r.owner.name || lead?.ownerName || "Hola").split(" ")[0];

    console.log(`  SENDING ${r.name} | ${stage} | ${nurturing.action} | ${r.owner.whatsapp} | ${firstName}`);

    const sid = await sendWhatsApp(r.owner.whatsapp, templateSid, { "1": firstName, "2": r.name });

    if (sid) {
      // Track in PanelActivity
      await p.panelActivity.create({
        data: { restaurantId: r.id, action: nurturing.action, details: { sid, whatsapp: r.owner.whatsapp, ownerName: firstName, restaurantName: r.name, stage, manual: true } },
      });
      // Log in WhatsAppMessage
      const msgBody = ACTION_MESSAGES[nurturing.action]?.(firstName, r.name) || "";
      const leadRecord = lead || await p.lead.findFirst({ where: { whatsapp: { contains: r.owner.whatsapp.replace("+", "") } }, select: { id: true } }).catch(() => null);
      await p.whatsAppMessage.create({
        data: { phone: r.owner.whatsapp, direction: "OUTBOUND", body: msgBody, twilioSid: sid, status: "sent", restaurantId: r.id, leadId: (leadRecord as any)?.id || null },
      }).catch(() => {});
      sent++;
      console.log(`    OK sid=${sid}`);
    } else {
      failed++;
      console.log(`    FAILED`);
    }

    // Small delay between sends
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\nDone: ${sent} sent, ${failed} failed`);
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
