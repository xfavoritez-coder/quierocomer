import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function detectDevice(ua: string | null): "mobile" | "desktop" {
  if (!ua) return "desktop";
  return /Mobile|Android|iPhone|iPod|Windows Phone/i.test(ua) && !/iPad/i.test(ua)
    ? "mobile"
    : "desktop";
}

function getIp(req: Pick<NextRequest, "headers"> | undefined): string | undefined {
  if (!req) return undefined;
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined
  );
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
  const ip = getIp(req);
  const enrichedDetails = {
    ...details,
    ...(deviceType && { deviceType }),
  };

  prisma.panelActivity.create({
    data: {
      restaurantId,
      ownerId: ownerId || null,
      action,
      details: Object.keys(enrichedDetails).length > 0 ? enrichedDetails : undefined,
      ...(ip && { ip }),
    },
  }).catch(() => {}); // fire-and-forget
}
