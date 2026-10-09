import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

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

// Alfabeto sin caracteres ambiguos (0/O/1/I/L) — fácil de escribir en una tablet.
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function genCode(n = 8): string {
  const b = randomBytes(n);
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHA[b[i] % ALPHA.length];
  return s;
}

// Genera (y persiste) un código de emparejamiento de corta duración para la KDS
// liviana, creando el token estable del KDS si aún no existe.
// POST { restaurantId } → { ok, code, expiresAt }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const restaurantId = String(body?.restaurantId || "");
  if (!restaurantId) return NextResponse.json({ ok: false, error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });

  const rest = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceStoreConfig: true } });
  const cfg = ((rest?.ecommerceStoreConfig as Record<string, unknown>) || {}) as Record<string, unknown>;

  const kdsToken = typeof cfg.kdsToken === "string" && cfg.kdsToken ? (cfg.kdsToken as string) : randomBytes(24).toString("base64url");
  const code = genCode(8);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

  const next = { ...cfg, kdsToken, kdsPairCode: code, kdsPairExp: expiresAt };
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { ecommerceStoreConfig: next as unknown as object } });

  return NextResponse.json({ ok: true, code, expiresAt });
}

// Revoca el acceso: regenera el token (las tablets vinculadas quedan fuera).
// DELETE { restaurantId }
export async function DELETE(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ ok: false, error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });

  const rest = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceStoreConfig: true } });
  const cfg = ((rest?.ecommerceStoreConfig as Record<string, unknown>) || {}) as Record<string, unknown>;
  const next = { ...cfg, kdsToken: randomBytes(24).toString("base64url"), kdsPairCode: null, kdsPairExp: null };
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { ecommerceStoreConfig: next as unknown as object } });
  return NextResponse.json({ ok: true });
}
