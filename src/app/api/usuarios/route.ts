import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { nombre, email, password, telefono, ciudad, estiloAlimentario, comidasFavoritas } = await req.json();

    if (!nombre || !email || !password) {
      return NextResponse.json({ error: "nombre, email y password requeridos" }, { status: 400 });
    }

    const existing = await prisma.usuario.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) return NextResponse.json({ error: "Email ya registrado" }, { status: 400 });

    const hash = await bcrypt.hash(password, 10);

    const usuario = await prisma.usuario.create({
      data: {
        nombre: nombre.trim(),
        email: email.toLowerCase().trim(),
        password: hash,
        telefono: telefono || null,
        ciudad: ciudad || "santiago",
        ...(estiloAlimentario && { estiloAlimentario }),
        ...(comidasFavoritas?.length && { comidasFavoritas }),
      },
      select: { id: true, nombre: true, email: true },
    });

    return NextResponse.json(usuario);
  } catch (error) {
    console.error("[Usuarios POST]", error);
    return NextResponse.json({ error: "Error al crear usuario" }, { status: 500 });
  }
}
