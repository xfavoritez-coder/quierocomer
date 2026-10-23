import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function chileDayStartUtc(now: Date = new Date()): Date {
  const diffMs = new Date(now.toLocaleString("en-US", { timeZone: "America/Santiago" })).getTime()
    - new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  const cl = new Date(now.getTime() + diffMs);
  cl.setUTCHours(0, 0, 0, 0);
  return new Date(cl.getTime() - diffMs);
}

/** POST /api/queue/register { slug, name, phone, partySize? }
 *  Auto-registro público del cliente en la fila virtual del local. */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`queue-register:${ip}`, { windowMs: 60_000, limit: 6 });
  if (!rl.success) return NextResponse.json({ error: "Demasiados intentos. Intenta en un momento." }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const slug = (body?.slug || "").toString();
  const name = (body?.name || "").toString().trim().slice(0, 80);
  const phone = (body?.phone || "").toString().trim().slice(0, 30);
  const partySize = Math.max(1, Math.min(50, Math.round(Number(body?.partySize) || 1)));
  if (!slug || !name || phone.replace(/\D/g, "").length < 8) {
    return NextResponse.json({ error: "Ingresa tu nombre y un teléfono válido." }, { status: 400 });
  }

  const r = await prisma.restaurant.findUnique({ where: { slug }, select: { id: true, queueEnabled: true } });
  if (!r) return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });
  if (!r.queueEnabled) return NextResponse.json({ error: "La fila virtual no está disponible en este momento." }, { status: 403 });

  const dayStart = chileDayStartUtc();
  // Evita registros duplicados del mismo teléfono el mismo día (si ya está en espera).
  const dup = await prisma.queueEntry.findFirst({
    where: { restaurantId: r.id, phone, createdAt: { gte: dayStart }, status: { in: ["WAITING", "NEAR"] } },
    select: { number: true },
  });
  if (dup) return NextResponse.json({ ok: true, number: dup.number, already: true });

  const last = await prisma.queueEntry.findFirst({
    where: { restaurantId: r.id, createdAt: { gte: dayStart } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const number = (last?.number ?? 0) + 1;
  const entry = await prisma.queueEntry.create({
    data: { restaurantId: r.id, number, name, phone, partySize, source: "public", status: "WAITING" },
    select: { number: true, createdAt: true },
  });

  const when = entry.createdAt.toLocaleString("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return NextResponse.json({ ok: true, number: entry.number, when });
}
