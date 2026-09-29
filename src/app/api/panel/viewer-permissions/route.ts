import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Solo el OWNER del local gestiona qué ve el perfil visor (no los team members).
async function assertOwner(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId || panelId.startsWith("tm_")) return false;
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

/** GET ?restaurantId=X → { sections: string[] | null } (null = ve todas). */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwner(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { viewerSections: true } });
  const sections = Array.isArray(r?.viewerSections) ? (r!.viewerSections as string[]) : null;
  return NextResponse.json({ sections });
}

/** PUT { restaurantId, sections: string[] | null } → guarda las secciones visibles del visor. */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwner(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const sections = Array.isArray(body?.sections) ? body.sections.filter((s: unknown) => typeof s === "string") : null;
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { viewerSections: sections as unknown as object } });
  return NextResponse.json({ ok: true, sections });
}
