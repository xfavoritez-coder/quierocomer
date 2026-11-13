// ═══════════════════════════════════════════════════════════
//  Notificaciones push PROMOCIONALES a los dispositivos de la app de un local.
//  GET  ?restaurantId=  → { count } dispositivos suscritos (opt-in).
//  POST { restaurantId, title, body, url? } → envía a todos (APNs/FCM) y poda
//  los tokens inválidos (optedIn=false). Reusa src/lib/ecommerce/nativePush.ts.
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/adminAuth";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import * as nativePush from "@/lib/ecommerce/nativePush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  if (isSuperAdmin(req)) return true;
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) return teamMemberCanAccess(panelId.slice(3), restaurantId);
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const [ios, android] = await Promise.all([
    prisma.appDevice.count({ where: { restaurantId, optedIn: true, platform: "ios" } }),
    prisma.appDevice.count({ where: { restaurantId, optedIn: true, platform: "android" } }),
  ]);
  return NextResponse.json({ count: ios + android, ios, android });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = String(body?.restaurantId || "").trim();
  const title = String(body?.title || "").trim();
  const text = String(body?.body || "").trim();
  const url = typeof body?.url === "string" && body.url.trim() ? body.url.trim() : undefined;
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (!title || !text) return NextResponse.json({ error: "Título y mensaje son obligatorios" }, { status: 400 });

  const devices = await prisma.appDevice.findMany({
    where: { restaurantId, optedIn: true },
    select: { id: true, platform: true, token: true },
  });
  if (!devices.length) return NextResponse.json({ ok: true, sent: 0, failed: 0, invalid: 0, total: 0 });

  const payload = { title: title.slice(0, 120), body: text.slice(0, 300), url, tag: `promo-${Date.now()}` };
  let sent = 0, failed = 0;
  const invalidIds: string[] = [];

  // Envío por lotes para no saturar (APNs/FCM aceptan paralelismo moderado).
  const CHUNK = 40;
  for (let i = 0; i < devices.length; i += CHUNK) {
    const batch = devices.slice(i, i + CHUNK);
    const results = await Promise.all(batch.map(async (d) => {
      try {
        const r = d.platform === "ios" ? await nativePush.sendApns(d.token, payload) : await nativePush.sendFcm(d.token, payload);
        return { d, r };
      } catch { return { d, r: { ok: false } as nativePush.NativePushResult }; }
    }));
    for (const { d, r } of results) {
      if (r.ok) sent++;
      else { failed++; if (r.invalid) invalidIds.push(d.id); }
    }
  }

  // Poda de tokens inválidos (dispositivos desinstalados / token caducado).
  if (invalidIds.length) {
    await prisma.appDevice.updateMany({ where: { id: { in: invalidIds } }, data: { optedIn: false } }).catch(() => {});
  }

  // Historial para el panel APP.
  await prisma.appPushLog.create({ data: { restaurantId, title: payload.title, body: payload.body, url, sent, failed, total: devices.length } }).catch(() => {});

  return NextResponse.json({ ok: true, sent, failed, invalid: invalidIds.length, total: devices.length });
}
