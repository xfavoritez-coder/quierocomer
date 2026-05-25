import { prisma } from "@/lib/prisma";

/**
 * Fire-and-forget activity logger for panel actions.
 * Call from any panel API to track what owners do.
 */
export function logActivity(
  restaurantId: string,
  action: string,
  details?: Record<string, any>,
  ownerId?: string,
) {
  prisma.panelActivity.create({
    data: { restaurantId, ownerId: ownerId || null, action, details: details || undefined },
  }).catch(() => {}); // fire-and-forget
}
