import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

/** Toggle isActive or update text for a variant. Body: { isActive?: boolean, text?: string } */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await ctx.params;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const data: any = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.text === "string") data.text = body.text.trim();
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Sin cambios" }, { status: 400 });

  await prisma.abVariant.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

/** Hard delete a variant. Use isActive=false instead if you want to keep history. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await ctx.params;
  await prisma.abVariant.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
