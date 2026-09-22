import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export type AuthedDriver = {
  id: string;
  restaurantId: string;
  username: string;
  displayName: string;
  role: string;
  isOnShift: boolean;
  sessionId: string;
};

/** Token opaco de 64 hex (como delivery_user_tokens). */
export function generateDriverToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function bearer(req: NextRequest): string {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/Bearer\s+(.+)/i);
  return m ? m[1].trim() : "";
}

/** Resuelve el repartidor desde el Bearer token. null si inválido/expirado. */
export async function authDriver(req: NextRequest): Promise<AuthedDriver | null> {
  const token = bearer(req);
  if (!token) return null;
  const session = await prisma.driverSession.findUnique({
    where: { token },
    include: { driver: { select: { id: true, restaurantId: true, username: true, displayName: true, role: true, active: true, isOnShift: true } } },
  });
  if (!session || !session.driver || !session.driver.active) return null;
  if (session.expiresAt && session.expiresAt.getTime() < Date.now()) return null;
  // last_seen (best-effort, no bloquea)
  prisma.driverSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  const d = session.driver;
  return { id: d.id, restaurantId: d.restaurantId, username: d.username, displayName: d.displayName, role: d.role, isOnShift: d.isOnShift, sessionId: session.id };
}
