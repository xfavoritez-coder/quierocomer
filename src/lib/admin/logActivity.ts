import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function detectDevice(ua: string | null): "mobile" | "desktop" {
  if (!ua) return "desktop";
  return /Mobile|Android|iPhone|iPod|Windows Phone/i.test(ua) && !/iPad/i.test(ua)
    ? "mobile"
    : "desktop";
}

/**
 * Fire-and-forget activity logger for panel actions.
 * Call from any panel API to track what owners do.
 */
export function logActivity(
  restaurantId: string,
  action: string,
  details?: Record<string, any>,
  ownerId?: string,
  req?: Pick<NextRequest, "headers">,
) {
  const deviceType = req ? detectDevice(req.headers.get("user-agent")) : undefined;
  const enrichedDetails = deviceType
    ? { ...details, deviceType }
    : details;

  prisma.panelActivity.create({
    data: { restaurantId, ownerId: ownerId || null, action, details: enrichedDetails || undefined },
  }).catch(() => {}); // fire-and-forget
}
