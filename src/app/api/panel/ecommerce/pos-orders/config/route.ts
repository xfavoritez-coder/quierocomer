import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) {
    const m = await prisma.teamMember.findUnique({ where: { id: panelId.slice(3) }, select: { restaurantId: true } });
    return m?.restaurantId === restaurantId;
  }
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

/** GET → token del webhook de pedidos del local (para configurar en Toteat). */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { toteatWebhookSecret: true } });

  // Diagnóstico: últimos intentos entrantes de este local + intentos con token
  // no reconocido (para ver si Toteat llega pero con el token equivocado).
  const logs = await prisma.posWebhookLog.findMany({
    where: { OR: [{ restaurantId }, { restaurantId: null }] },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { id: true, ok: true, reason: true, processed: true, tokenPreview: true, tokenVia: true, headerKeys: true, ip: true, bodyPreview: true, createdAt: true, restaurantId: true },
  });

  return NextResponse.json({ token: r?.toteatWebhookSecret ?? null, logs });
}

/** POST → genera (si falta) o rota el token del webhook. Body: { restaurantId, rotate? } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { toteatWebhookSecret: true } });
  if (r?.toteatWebhookSecret && !body?.rotate) return NextResponse.json({ token: r.toteatWebhookSecret });

  const token = crypto.randomBytes(24).toString("hex");
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { toteatWebhookSecret: token } });
  return NextResponse.json({ token });
}
