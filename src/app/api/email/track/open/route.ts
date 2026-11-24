import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// 1x1 transparent GIF
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

// Mínimo 60 segundos después del envío para contar como apertura real.
// Filtra pre-fetch de Gmail, Outlook, Apple Mail, Yahoo, etc.
const MIN_DELAY_MS = 60_000;

// Patrones de bots y proxies de email conocidos
const BOT_PATTERNS = [
  /GoogleImageProxy/i,
  /GoogleMailProxy/i,
  /YahooMailProxy/i,
  /Outlook/i,
  /Microsoft Office/i,
  /bot/i,
  /crawler/i,
  /spider/i,
  /prefetch/i,
  /pre-fetch/i,
  /wget/i,
  /curl/i,
  /link.?preview/i,
];

function isBot(ua: string | null): boolean {
  if (!ua) return true;
  return BOT_PATTERNS.some((p) => p.test(ua));
}

const headers = {
  "Content-Type": "image/gif",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
} as const;

/**
 * GET /api/email/track/open?eid=<emailLogId>
 * Returns a 1x1 transparent GIF and marks the email as opened.
 * Filtra bots/proxies de email y requiere un delay mínimo para evitar falsos positivos.
 */
export async function GET(req: NextRequest) {
  const eid = req.nextUrl.searchParams.get("eid");
  const ua = req.headers.get("user-agent");

  if (eid && !isBot(ua)) {
    // Verificar que hayan pasado al menos MIN_DELAY_MS desde el envío
    const log = await prisma.emailLog.findUnique({ where: { id: eid }, select: { openedAt: true, createdAt: true } }).catch(() => null);
    if (log && !log.openedAt) {
      const elapsed = Date.now() - log.createdAt.getTime();
      if (elapsed >= MIN_DELAY_MS) {
        prisma.emailLog.update({ where: { id: eid }, data: { openedAt: new Date() } }).catch(() => {});
      }
    }
  }

  return new Response(PIXEL, { status: 200, headers });
}
