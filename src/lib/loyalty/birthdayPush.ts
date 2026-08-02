import { prisma } from "@/lib/prisma";
import { notifyMemberListDevices } from "@/lib/wallet/apns";
import { sendGoogleObjectMessage } from "@/lib/wallet/google";

/**
 * Envía notificaciones push de cumpleaños a todos los miembros que cumplen años hoy
 * en cada programa con birthdayEnabled = true.
 * Se llama desde el cron diario. Deduplicado por año (lastBirthdayNotifAt).
 *
 * @returns resumen de restaurantes y destinatarios procesados
 */
export async function runBirthdayPushes(): Promise<{ restaurants: number; members: number }> {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const yearStart = new Date(today.getFullYear(), 0, 1); // 1 ene de este año

  // Programas con cumpleaños activado
  const programs = await prisma.loyaltyProgram.findMany({
    where: { birthdayEnabled: true, birthdayMessage: { not: null } },
    select: { id: true, restaurantId: true, birthdayTitle: true, birthdayMessage: true },
  });

  let totalMembers = 0;

  for (const program of programs) {
    try {
      // Miembros que cumplen hoy y no han recibido notif este año
      const members = await prisma.$queryRaw<{ id: string; googleObjectId: string | null }[]>`
        SELECT id, "googleObjectId" FROM "LoyaltyMember"
        WHERE "restaurantId" = ${program.restaurantId}
          AND "revoked" = false
          AND "birthDate" IS NOT NULL
          AND EXTRACT(MONTH FROM "birthDate") = ${month}
          AND EXTRACT(DAY   FROM "birthDate") = ${day}
          AND ("lastBirthdayNotifAt" IS NULL OR "lastBirthdayNotifAt" < ${yearStart})
      `;

      if (!members.length) continue;

      const memberIds = members.map((m) => m.id);
      const message = program.birthdayMessage!;
      const title = program.birthdayTitle || "";

      // Apple: actualizar pushMessage y solo notificar a estos miembros
      const appleValue = title ? `${title}: ${message}` : message;
      const appleValueUniq = `${appleValue}\u200b${Date.now()}`;
      await prisma.loyaltyProgram.update({
        where: { id: program.id },
        data: { pushMessage: appleValueUniq },
      });
      await prisma.loyaltyMember.updateMany({
        where: { id: { in: memberIds } },
        data: { updatedAt: new Date() },
      });
      await notifyMemberListDevices(memberIds);

      // Google: mensaje a cada tarjeta
      for (const m of members.filter((x) => x.googleObjectId)) {
        try {
          await sendGoogleObjectMessage(m.googleObjectId!, title || "¡Feliz cumpleaños!", message);
        } catch (e) {
          console.error("[BirthdayPush] Google:", e);
        }
      }

      // Marcar como notificados
      await prisma.loyaltyMember.updateMany({
        where: { id: { in: memberIds } },
        data: { lastBirthdayNotifAt: new Date() },
      });

      totalMembers += members.length;

      // Registrar en historial de broadcasts
      await prisma.loyaltyBroadcast.create({
        data: {
          restaurantId: program.restaurantId,
          title,
          body: message,
          recipients: members.length,
          filter: "birthday_today",
        },
      });

      console.log(`[BirthdayPush] ${program.restaurantId}: ${members.length} cumpleañeros notificados`);
    } catch (e) {
      console.error(`[BirthdayPush] Error en ${program.restaurantId}:`, e);
    }
  }

  return { restaurants: programs.length, members: totalMembers };
}
