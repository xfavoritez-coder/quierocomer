import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSellerFromRequest } from "@/lib/ventas/session";

export const runtime = "nodejs";

/** POST /api/ventas/sellers  (solo ADMIN)  Body: { name, email, role? }  → agrega un vendedor. */
export async function POST(req: NextRequest) {
  const me = await getSellerFromRequest(req);
  if (me?.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim().slice(0, 80);
  const email = String(body?.email || "").trim().toLowerCase();
  const role = body?.role === "ADMIN" ? "ADMIN" : "SELLER";
  if (!name) return NextResponse.json({ error: "Falta el nombre" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Correo no válido" }, { status: 400 });
  const exists = await prisma.seller.findUnique({ where: { email }, select: { id: true } });
  if (exists) return NextResponse.json({ error: "Ese correo ya está en el equipo" }, { status: 409 });
  const seller = await prisma.seller.create({ data: { name, email, role }, select: { id: true, name: true, email: true, role: true, active: true } });
  return NextResponse.json({ seller });
}

/** PATCH /api/ventas/sellers  (solo ADMIN)  Body: { id, active?, role? } */
export async function PATCH(req: NextRequest) {
  const me = await getSellerFromRequest(req);
  if (me?.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  if (id === me.id) return NextResponse.json({ error: "No puedes cambiar tu propia cuenta" }, { status: 400 });
  const data: { active?: boolean; role?: "ADMIN" | "SELLER" } = {};
  if (typeof body.active === "boolean") data.active = body.active;
  if (body.role === "ADMIN" || body.role === "SELLER") data.role = body.role;
  const seller = await prisma.seller.update({ where: { id }, data, select: { id: true, name: true, email: true, role: true, active: true } });
  return NextResponse.json({ seller });
}
