import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  try {
    const locales = await prisma.local.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, slug: true, nombre: true, email: true, telefono: true,
        ciudad: true, comuna: true, direccion: true, categorias: true,
        logoUrl: true, portadaUrl: true, lat: true, lng: true,
        instagram: true, sitioWeb: true, descripcion: true,
        activo: true, createdAt: true, vistas: true, linkPedido: true,
        _count: { select: { menuItems: true } },
      },
    });
    return NextResponse.json(locales);
  } catch (error) {
    console.error("[Admin locales]", error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  try {
    const { nombre, email, password, comuna, direccion, categorias, descripcion, telefono, instagram, sitioWeb, lat, lng } = await req.json();
    if (!nombre || !email || !password) return NextResponse.json({ error: "nombre, email y password requeridos" }, { status: 400 });

    const existing = await prisma.local.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "Email ya registrado" }, { status: 400 });

    const hashed = await bcrypt.hash(password, 10);
    const local = await prisma.local.create({
      data: {
        nombre, email, password: hashed, comuna: comuna ?? "", direccion: direccion ?? "",
        categorias: categorias ?? [], descripcion: descripcion ?? null,
        telefono: telefono ?? null, instagram: instagram ?? null, sitioWeb: sitioWeb ?? null,
        lat: lat ?? null, lng: lng ?? null,
      },
      select: {
        id: true, nombre: true, email: true, comuna: true, createdAt: true,
        _count: { select: { menuItems: true } },
      },
    });
    return NextResponse.json(local);
  } catch (error) {
    console.error("[Admin locales POST]", error);
    return NextResponse.json({ error: "Error al crear" }, { status: 500 });
  }
}
