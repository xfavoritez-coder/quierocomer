import { prisma } from "@/lib/prisma";

type TriggeredBy = "post_genio_capture" | "conversion_cta" | "birthday_banner" | "favorites_threshold" | "experience";

interface TrackRegistrationParams {
  qrUserId: string;
  guestId: string | null;
  restaurantId: string;
  sessionId: string | null;
  triggeredBy: TriggeredBy;
  genioSessionId?: string | null;
  dbSessionId?: string | null;
}

/**
 * Unified registration tracking — called from all registration points.
 * Wraps in a transaction:
 * 1. Creates USER_REGISTERED event in StatEvent
 * 2. Sets GuestProfile.convertedToUserAt
 * 3. Marks Session.converted = true
 */
export async function trackUserRegistration({
  qrUserId,
  guestId,
  restaurantId,
  sessionId,
  triggeredBy,
  genioSessionId,
  dbSessionId,
}: TrackRegistrationParams) {
  try {
    // Resolve dbSessionId server-side if the client hadn't created it yet
    // (sessionTracker delays Session row creation by ~3s after first interaction).
    let resolvedDbSessionId = dbSessionId || null;
    if (!resolvedDbSessionId && guestId) {
      const recent = await prisma.session.findFirst({
        where: {
          guestId,
          restaurantId,
          OR: [
            { endedAt: null },
            { endedAt: { gte: new Date(Date.now() - 5 * 60_000) } },
          ],
        },
        orderBy: { startedAt: "desc" },
        select: { id: true },
      });
      if (recent) resolvedDbSessionId = recent.id;
    }

    await prisma.$transaction(async (tx) => {
      // 1. Create USER_REGISTERED stat event
      await tx.statEvent.create({
        data: {
          eventType: "USER_REGISTERED",
          restaurantId,
          sessionId: sessionId || guestId || "",
          guestId: guestId || undefined,
          qrUserId,
          genioSessionId: genioSessionId || undefined,
          dbSessionId: resolvedDbSessionId || undefined,
          metadata: {
            triggered_by: triggeredBy,
            previous_guest_id: guestId,
          },
        },
      });

      // 2. Set GuestProfile.convertedToUserAt
      if (guestId) {
        await tx.guestProfile.updateMany({
          where: { id: guestId, convertedToUserAt: null },
          data: { convertedToUserAt: new Date() },
        });
      }

      // 3. Mark current session as converted using the resolved dbSessionId.
      if (resolvedDbSessionId) {
        await tx.session.updateMany({
          where: { id: resolvedDbSessionId },
          data: { converted: true },
        });
      }
    });
  } catch (error) {
    console.error("trackUserRegistration error:", error);
    // Non-blocking — don't fail registration if tracking fails
  }
}
