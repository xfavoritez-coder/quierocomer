import { PrismaClient } from "@prisma/client";
import { sendAdminEmail, trialEndingSoonEmailHtml } from "@/lib/email/sendAdminEmail";
const db = new PrismaClient();

async function main() {
  const now = new Date();
  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const trialsEndingSoon = await db.restaurant.findMany({
    where: {
      subscriptionStatus: "TRIALING",
      trialEndsAt: { gt: now, lte: twoDaysFromNow },
      flowSubscriptionId: null,
      billingExempt: false,
      trialReminderSentAt: null,
      slug: "fogon-del-puerto", // solo nuestro test
    },
    select: {
      id: true, name: true, trialEndsAt: true,
      owner: { select: { email: true, name: true } },
    },
  });

  console.log("Trials ending soon:", trialsEndingSoon.length);

  for (const r of trialsEndingSoon) {
    if (!r.owner?.email) { console.log("Sin email, skip"); continue; }
    const daysLeft = Math.max(1, Math.ceil(((r.trialEndsAt?.getTime() || now.getTime()) - now.getTime()) / (24 * 60 * 60 * 1000)));
    const firstName = (r.owner.name || "").split(" ")[0] || "Hola";
    const baseUrl = "https://quierocomer.cl";

    console.log(`Enviando email a ${r.owner.email} — ${firstName}, ${daysLeft} día(s) restantes`);

    await sendAdminEmail({
      to: r.owner.email,
      subject: `🎁 Tu regalo Premium en ${r.name} termina ${daysLeft === 1 ? "mañana" : `en ${daysLeft} días`}`,
      html: trialEndingSoonEmailHtml(firstName, r.name, daysLeft, `${baseUrl}/panel`, `${baseUrl}/panel/suscripcion`),
      purpose: "trial_reminder",
    });

    await db.restaurant.update({
      where: { id: r.id },
      data: { trialReminderSentAt: now },
    });

    console.log("✓ Email de reminder enviado y marcado");
  }
}

main().catch(console.error).finally(() => db.$disconnect());
